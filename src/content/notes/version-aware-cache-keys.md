---
title: 模型改名后为什么还会读到旧值：追踪版本缓存与失效竞态
slug: version-aware-cache-keys
description: 沿元素读取、版本上下文、事务提交和异步监听追踪一次改名，用 Guava 33.4.8 的四个确定性实验复现负缓存、失效窗口与旧加载回填，并验证代次隔离方案。
status: published
publishedAt: 2026-09-15
topics: [modeling, architecture]
kind: architecture
---

假设一个建模元素刚从“控制模块”改成“控制单元”：写接口返回成功，重新打开属性面板，名称却还是旧的。清缓存可能恢复，但它没有回答两个问题：旧名称从哪里返回？下一次为什么不会再发生？

本文用这个**构造场景**追踪 SE-MBSE 的元素缓存。源码中的读写链路与实验输出分开说明：前者来自当前工程，后者使用相同版本的 Guava，在独立进程中固定线程顺序，不代表线上发生过同样的事故。

追踪得到三个具体结论：缓存键中的版本标记和查询参数不是同一个数；正常事务路径先提交，再派发默认异步的失效监听；即便失效同步完成，尚未结束的加载仍可能回填旧值。下面逐项说明，并附可运行实验。

## 1. 先确定旧值在哪一层

`ElementCacheManager` 使用进程内 Guava 缓存 `ElementCacheVO`，未命中时调用 `ElementMapper`，最终查询 Ignite。本文讨论的是这份本地元素快照，不把它与 Ignite 写后落库缓冲或数据库混在一起。

普通读取的真实调用顺序为：

```text
业务调用 getElementCacheByDataId(dataId, projectId)
  → getCacheKey：根据版本上下文生成 key
  → LoadingCache.getUnchecked(key)
      ├─ 命中：取 Optional 中的 VO
      └─ 未命中：CacheLoader.load(key)
                   → buildEntry(key)
                   → ElementMapper.selectCacheByDataId(dataId, projectId)
                   → 版本上下文切换（必要时）
                   → IgniteVersionTemplate.queryOnVersion(...)
  → BeanCopierUtils.copyProperties(...)
  → 返回调用方
```

只要 Guava 命中，Mapper 就不会执行。定位旧值时，先记录本次到底是命中还是加载，才能决定是否继续检查 Ignite 的查询结果。

缓存配置如下，常量替换为实际数值：

```java
LoadingCache<String, Optional<ElementCacheVO>> elementCache =
    CacheBuilder.newBuilder()
        .maximumSize(10000)
        .expireAfterWrite(30, TimeUnit.MINUTES)
        .build(new CacheLoader<>() {
            @Override
            public Optional<ElementCacheVO> load(String key) {
                return Optional.ofNullable(buildEntry(key));
            }
        });
```

这里是最多一万条、写入后 30 分钟过期，频繁读取不会延长到“最后访问后 30 分钟”。过期限制驻留时间，不能代替一次改名后的即时失效。

`getUnchecked` 未命中时会启动加载，并非只检查现有值。Guava 对同键的并发加载提供等待复用机制，但它不会因此把业务写入和缓存失效组成事务。[LoadingCache API](https://guava.dev/releases/33.4.8-jre/api/docs/com/google/common/cache/LoadingCache.html)

## 2. 草稿 key 的 0，不是查询版本 0

`AbstractVersionedCacheManager.buildCacheKey` 的关键逻辑是：

```java
int version = context.getQueryMode() == VersionControlQueryType.DRAFT
    ? 0
    : context.getVersion();

return getCacheKeyPrefix() + context.getProjectId()
    + ":" + context.getBranchId()
    + ":" + version
    + ":" + dataId;
```

用独立示意标识说明。当前工程为 2000001，分支为 3000001，元素为 4000001：

| 读取口径 | 生成的 key |
| --- | --- |
| 当前分支草稿 | elementCache:2000001:3000001:0:4000001 |
| 当前分支版本 7 | elementCache:2000001:3000001:7:4000001 |
| 另一分支版本 7 | elementCache:2000001:3000002:7:4000001 |

0 让不断变化的草稿复用一个缓存身份。底层查询仍使用上下文中的 version，并附加草稿过滤条件。

继续看加载函数：

```java
// ElementCacheManager.buildEntry：摘取调用关系 
BaseCacheEntry cacheEntry = new BaseCacheEntry();
fillEntryFromKey(key, cacheEntry);
Long dataId = cacheEntry.getDataId();
Long projectId = cacheEntry.getProjectId();
// 原实现随后过滤小于 1000000 的内置标识，并处理空结果。
ElementEntity element =
    elementMapper.selectCacheByDataId(dataId, projectId);
```

键里解析出了 branchId 和 version，但这里没有把它们显式传给查询。真正的版本选择发生在后面的线程上下文中：

1. `MetaVersionMapper.selectCacheByDataId(dataId, projectId)` 判断目标工程。
2. 本工程继续使用当前上下文；外部工程调用 `VersionControlServiceImpl.executeByProjectId`。
3. 后者查工程引用，切换到被引用分支与版本，执行查询，并在 finally 中恢复原上下文。
4. Mapper 加入 branch_id、data_id 索引条件，`IgniteVersionTemplate.versionControlCondition` 再过滤版本。

过滤条件可等价表达为以下公式，版本区间两端都包含：

```text
validFrom ≤ context.version ≤ validTo
AND entity.projectId = context.projectId
AND entity.branchId  = context.branchId
AND entity.isDeleted = 0
AND（如果是 DRAFT，则 entity.latest 必须为 true）
```

因此必须维持：

```text
生成 key 时所代表的视图 = 执行 Mapper 时上下文所代表的视图
```

不能把 `buildEntry(key)` 随手搬到没有版本上下文的线程里，也不能把 key 中的草稿标记 0 当作查询版本。若要把加载器改成只依赖 key 的函数，应通过版本服务重建完整上下文；它还涉及查询模式和工程引用信息，不能只设置四个数字。

### 外部工程有两次需要对齐的选择

若工程 A 引用工程 B 的分支 3000002、版本 7，缓存 key 来自 `ProjectImport`，加载器后面的上下文切换也必须落到同一份引用。

当前缓存入口对“没有引用”或“引用尚未关联”返回空 key，直接结束读取。它不会进入 loader，也不会自动走版本服务的其他回退路径。分析行为时，要沿实际经过的条件分支阅读，不能把底层方法具备的所有能力都算到这条调用链上。

## 3. 一次改名怎样走到失效

沿 `ElementServiceImpl.updateName` 继续追踪：

```text
updateName(dataId, newName)
  → 读取 ElementEntity，设置 name
  → updateOnVersion
      → 名称校验、设置 userModified
      → MetaVersionMapper.updateByIdOnVersion
          → IgniteVersionTemplate.updateById
              → 记录 UPDATE 事件
              → 写草稿；若原记录已发布，则走新增草稿路径
  → 最外层事务正常提交
  → 派发累计事件
  → ElementChangeEventHandler.handleElementDeleteChange
      → elementCacheManager.invalidate(dataId, projectId)
```

这里有两个容易忽略的事实。

**方法名不能代替注解。** `handleElementDeleteChange` 实际订阅 INSERT、UPDATE、DELETE 三种变更。它同时负责改名后的失效，以及“此前查不到、后来创建”的负缓存失效。

**已追踪的正常事务路径确实先提交再派发。** `IgniteTransactionTemplate.execute` 新建事务时的顺序是：

```java
T result = action.doInTransaction(tx);
tx.commit();
IgniteTransactionContext.publishVersionTableChangeEvents(changeEventPublisher);
return result;
```

已有外层事务时，当前调用复用它，事件由外层正常完成路径派发。`IgniteTransactionAspect` 的正常提交分支同样先 commit 再发布。这里没有把禁用事务、未建立事务或其他异常分支一起概括成保证投递。

再看元素监听声明：

```java
@VersionTableChangeListener(
    entityTypes = ElementEntity.class,
    changeTypes = {
        VersionTableChangeType.INSERT,
        VersionTableChangeType.UPDATE,
        VersionTableChangeType.DELETE
    }
)
```

没有指定 `async = false`，而注解的默认值为 true。发布器会把它交给 eventExecutor，并不等待该监听器完成。

于是存在这样的调度顺序：

```text
T1  Ignite 提交：底层名称已是 NEW
T2  失效任务被提交给执行器
T3  写请求返回；另一个请求命中 Guava，读到 OLD
T4  监听器执行 invalidate
T5  下一次读取未命中，加载 NEW
```

这是可发生的顺序，不是每次都必然返回旧值。是否预先缓存、任务调度和请求交错都会影响实际观察。

### 异步上下文不是凭空存在的

项目已经有传播实现：`VersionControlContext` 使用 `TransmittableThreadLocal`；当前 eventExecutor 通过 `ContextPropagatingExecutorService` 包装，其 execute 调用 `ContextTaskDecorator.decorate`，装饰器使用 `TtlRunnable.get` 捕获 TTL 上下文，并处理 MDC 的恢复。

所以不能只看到“异步”就断言监听器拿不到工程和分支。

但提交时捕获上下文，也不等于获得业务上完全不可变的深快照。引用列表等可变成员仍需单独审查。当前 invalidate 会从上下文重新计算 key，因此“在哪个视图执行失效”同样属于这条链路的输入。

## 4. 三个实验，区分不同的旧值来源

下面使用项目声明的 **Guava 33.4.8-jre** 与 **JDK 21.0.7**，实际运行独立实验。没有启动 Spring、Ignite 或数据库；`AtomicReference<String>` 模拟底层名称，缓存使用真正的 Guava。

[完整 Java 实验](../../examples/version-cache/CacheConsistencyLab.java)和[运行说明](../../examples/version-cache/README.md)随文章提供。通过 CountDownLatch 固定先后顺序，每次等待都有超时，不依赖 sleep 或随机压力。

### 实验 A：查不到，也是会命中的结果

先让数据源为 null，第一次读取返回 Optional.empty()；然后数据源变为 NEW，再读相同 key；最后执行 invalidate，再读一次。

实际输出：

```text
negative: empty -> empty -> NEW; loads=2
```

第二次读取没有重新访问数据源。Optional 将“没有元素”变成合法缓存值，因此 INSERT 也必须参与失效。只订阅 UPDATE 与 DELETE，新创建的元素仍可能被负缓存遮挡。

还要区分另一种空返回：未关联引用得到空 key，会在进入 Guava 前退出，不会存成 Optional.empty()。

### 实验 B：失效任务已提交，但还没删除

先缓存 OLD，把底层名称更新为 NEW，然后提交失效任务，在删除前用门闩暂停它：

```java
source.set("NEW");
var invalidation = executor.submit(() -> {
    entered.countDown();
    await(release);
    cache.invalidate(key);
});
await(entered);
read();                 // 任务已开始，但尚未删除：OLD
release.countDown();
invalidation.get();
read();                 // 失效完成后重新加载：NEW
```

这是完整实验的时序节选，其中 read() 代指带断言的 getUnchecked。实际输出：

```text
async: before-listener=OLD; after-listener=NEW
```

门闩只是把窗口固定到可观察，并没有测量实际项目的失效延迟。

### 实验 C：同步删除以后，旧加载还能回来

如果把监听器改成同步，是否足够？看另一条时间线：

| 顺序 | 读线程 R | 写线程 W |
| --- | --- | --- |
| 1 | 未命中，loader 从数据源取得 OLD | |
| 2 | loader 暂停，尚未返回给 Guava | |
| 3 | | 数据源更新为 NEW |
| 4 | | invalidate(key) 已执行完 |
| 5 | loader 返回之前取得的 OLD | |
| 6 | 后续请求再次读取这个 key | |

实验暂停第一次加载的“读取后、返回前”阶段：

```java
@Override
public Optional<String> load(String key) {
    String snapshot = source.get();
    if (loads.incrementAndGet() == 1) {
        captured.countDown();
        await(release);
    }
    return Optional.ofNullable(snapshot);
}
```

主线程等 captured 后更新数据源、同步 invalidate，最后放行 loader。真实输出：

```text
in-flight: source=NEW; cached=OLD; loads=1
```

loads=1 说明后续请求命中了回填的 OLD，没有重新加载。它与实验 B 不同：**删除已完成，旧值仍能重新进入缓存。**

Guava 的 invalidate API 描述的是丢弃缓存值，没有提供“取消已在执行的 loader，并禁止其结果回填”的业务协议。[Cache API](https://guava.dev/releases/33.4.8-jre/api/docs/com/google/common/cache/Cache.html)

实验确认了同版本缓存库在该顺序下的行为。要证明 SE-MBSE 某条真实请求发生了同样的交错，还需要对真实 loader 和写提交点加入受控屏障；不能直接把这个机制实验称为线上缺陷复现。

## 5. 给旧加载一个不能污染新读者的身份

对于实验 C，再删一次很难给出可靠完成条件：第二次删除之后仍可能有更慢的旧加载返回。固定延迟同样依赖一个通常无法证明的加载耗时上限。

一种方案是为每个业务身份附加失效代次：

```text
业务身份 K = 工程 + 分支 + 视图 + 元素
实际缓存身份 = (K, generation)
```

底层提交后推进 K 的 generation。读请求先取当前代次，再读对应缓存。旧 loader 即使回来，也只会填入旧代次。

第四个实验使用以下结构：

```java
record Key(String element, long generation) {}

// 旧读请求已经取得 generation=0，加载暂停。
source.set("NEW");
generation.incrementAndGet(); // 实验中同步完成

// 放行旧加载以后：
cache.getUnchecked(new Key(element, 0));                 // OLD
cache.getUnchecked(new Key(element, generation.get()));  // NEW
```

实际输出：

```text
generation: old-reader=OLD; next-reader=NEW
```

改善的是旧加载不会污染新代次的后续读取。已经开始的旧请求仍返回 OLD，不能把这个结果说成所有并发读都具有强一致性。

要在项目落地，必须继续处理四件具体事情：

1. **推进时间。** 若 generation 仍在异步监听中推进，实验 B 的窗口依然存在。若要求“写请求完成后本节点下一次读必须更新”，应在正常提交后、响应前完成推进，并定义推进失败的处理。
2. **代次不能误复用。** 不能清掉代次映射后随意从 0 重来，否则可能与仍存活的旧缓存项碰撞。需要不会复用的标记，或能证明旧代次已不可访问的回收规则。
3. **预热也要遵守规则。** 当前还有 ProjectCachePreloader → ElementCacheManager.preload → asMap().putAll 这条填充路径。它也必须使用读取数据时对应的代次，否则旧批量快照仍可能被写到新身份。
4. **节点范围。** Guava 是本地缓存，实验只有一个进程。如果实际部署多个应用实例，每个节点怎样获知推进需要另一套传播机制；本地 AtomicLong 解决不了跨节点一致性。

这是候选方案与机制验证，本文没有把它改进 SE-MBSE。是否采用，应根据读取要求，以及维护代次和跨节点传播的成本判断。

## 6. 建模场景还要处理名称路径

当前实现将 qualifiedName 与 qualifiedNameStr 分开。用示意数据说明：

```text
内部路径：4000001::4000002::4000003
显示路径：整车::动力系统::控制单元
```

`getElementCacheWithQualifiedName` 先取得元素副本，再调用 `getNamePath`：拆分 ID 路径、逐个读取当前视图的名称、拼接显示字符串。

这样，父元素只改名时，子元素的 ID 路径可以不变；父元素快照失效后，重新计算显示路径就能用上新名称。若将完整显示路径长期缓存到每个子元素里，父级改名还需要找到并更新全部受影响子项。

这种分层不是没有成本：深度为 d 的路径需要 d 次元素缓存访问；全冷时，每次 loader 还可能额外查询 owner 类型。因此不能把 d 次缓存访问直接当成 d 次数据库查询，也不能在没有测量时宣称固定的加速倍数。

读取返回前，`BeanCopierUtils` 会创建新 VO。进一步核对 `ElementCacheVO` 及其父类 `BriefVO`，当前字段是字符串、包装类型、枚举、LocalDateTime 等，没有列表字段。所以这里实际要防止的是调用方补充 qualifiedNameStr 等信息时修改共享 VO；泛泛讨论“嵌套集合污染”，并没有对应到这个类的现状。

## 7. 用能区分原因的场景验收

只测试“改名后刷新一次”不够。至少需要：

| 场景 | 核对事实 |
| --- | --- |
| 同 ID 草稿和历史版本交替读取 | key、Mapper 上下文和结果属于同一视图 |
| A 工程读取 B 的引用 | 切换到指定引用版本，返回或抛错后恢复 A 上下文 |
| 先查不到，再创建 | INSERT 参与失效，负缓存不继续遮挡元素 |
| 写提交后暂停监听器 | 明确现有窗口是否满足产品读取要求 |
| loader 取得 OLD 后暂停，再写入并失效 | 覆盖加载中的回填竞态，而不仅是已有缓存项 |
| 预热期间发生编辑 | 批量填充不能绕过普通加载的一致性规则 |

排障记录应关联业务 key、查询上下文、提交标识和失效阶段。先分辨返回的 OLD 来自 Guava 命中、底层新读，还是先前尚未完成的 loader，才能选择处理方式。

这条链路最终有三个可检查的关系：**key 的视图是否等于查询视图；提交是否先于失效；失效完成后旧工作是否仍能回填。** 前两项沿代码核对，第三项用受控并发实验验证，才能对“改名后读到什么”给出有边界的答案。

## 源码与实验范围

基于 SE-MBSE 提交 `67b9805a06` 核对。以下路径相对于相应模块的 Java 源码包：

- project：`metamodel/cache/manager/AbstractVersionedCacheManager.java`、`ElementCacheManager.java`、`ProjectCachePreloader.java`。
- project：`config/MetaVersionMapper.java`、`utils/IgniteVersionTemplate.java`、`management/service/impl/VersionControlServiceImpl.java`。
- project：`metamodel/service/impl/ElementServiceImpl.java`、`event/ElementChangeEventHandler.java`、`metamodel/vo/accessory/ElementCacheVO.java`、`BriefVO.java`。
- core：`ignite/transaction/IgniteTransactionTemplate.java`、`IgniteTransactionAspect.java`、`IgniteTransactionContext.java`。
- core：`ignite/event/VersionTableChangeListener.java`、`VersionTableChangeEventPublisher.java`。
- core：`version/VersionControlContext.java`、`config/ThreadExecutorConfig.java`、`ContextTaskDecorator.java`、`ContextPropagatingExecutorService.java`、`util/BeanCopierUtils.java`。

四个实验已实际执行，[完整输出在这里](../../examples/version-cache/expected-output.txt)。未运行业务数据库、全系统并发测试，也未把候选方案实现到项目中。
