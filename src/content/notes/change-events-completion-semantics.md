---
title: "Future 完成了，监听器却还没结束：版本事件的完成语义"
slug: change-events-completion-semantics
description: "沿 publishEventAsync、异步监听器提交和事务提交顺序，拆解错误传播、父类匹配、事件快照与可靠交付的边界。"
status: published
publishedAt: 2026-09-15
topics: [architecture, modeling]
kind: architecture
updatedAt: 2026-09-16
---

调用 `publishEventAsync(event).join()` 之后，能不能断言缓存失效、索引更新和协作通知已经结束？

在 SE-MBSE 当前的 `VersionTableChangeEventPublisher` 中，不能。这里返回的 Future 包住了分发过程；异步监听器被再次提交到线程池，没有加入这个 Future。

这个差别会直接影响测试断言和后续业务操作，值得沿代码拆开。

## 第一层异步：调用者离开发布线程

发布器的实现很短：

```java
public CompletableFuture<Void> publishEventAsync(
        VersionTableChangeEvent event) {
    return CompletableFuture.runAsync(
        () -> publishEvent(event), executor);
}
```

而 `publishEvent` 依次调用：

```text
processSyncEvent(event)
processAsyncEvent(event)
```

“同步监听器”在这里指相对于分发线程同步执行。如果调用者选择 `publishEventAsync`，它们也已经不在原调用线程上。

## 第二层异步：分发器只负责提交

`processAsyncEvent` 为每个匹配监听器选择线程池，然后调用 `executorService.execute(...)`。这个方法没有收集子任务 Future，也没有等待它们完成。

于是合法时序是：

```text
T0  调用 publishEventAsync，拿到 outerFuture
T1  分发线程执行同步监听器
T2  分发线程提交异步监听器 L1、L2
T3  publishEvent 返回，outerFuture 完成
T4  调用者 join 返回，开始读索引
T5  L2 才开始更新索引
T6  L1、L2 全部结束
```

本文实验包用可控队列模拟“外层提交内层任务”，输出：

```text
events/nested: outer-complete=true while child-complete=false
```

这是独立的调度模型实验，用来固定这个反例；没有把它冒充为 Spring 容器内对 Java 发布器的集成测试。源码证据则是两层提交之间缺少完成组合。

## 即使等到了，成功又表示什么

同步和异步监听器调用都被 `try/catch` 包裹，异常记录日志后继续。于是“发布 Future 正常完成”不仅不保证异步监听器结束，也不保证同步监听器全部成功。

还要区分监听器异常与提交异常：线程池拒绝任务、查找指定线程池 Bean 失败，发生在任务提交路径上，不能一概套用监听器内部的吞异常行为。

如果业务需要“所有必要监听器完成”，可以把契约设计成下面这样的结果，而不是继续沿用一个含义模糊的 void：

```java
// 设计示意，并非当前仓库实现
record ListenerResult(String name, boolean success, Throwable error) {}

CompletionStage<List<ListenerResult>> publishAndAwait(Event event);
```

内部应收集每个监听器的完成阶段，用 `allOf` 等方式组合，再决定失败是聚合返回还是整体异常。别在线程池任务里阻塞等待同一个已饱和线程池的子任务；完成组合也需要避免把线程都占在等待上。

## 父类订阅与按父类取数据不是同一个规则

发布器沿实体继承链匹配监听器，并用 `HashSet` 去重。一个订阅父类的监听器，可以收到子类变更通知；集合去重同时意味着不能依赖监听器注册顺序来表达业务先后关系。

再看事件读取：

- `VersionTableChangeMethodListener.filterEvent` 用 `isAssignableFrom` 判断匹配，加入的还是原始变更条目。
- `VersionTableChangeEvent.getChangeEntities(Class)` 按传入 Class 精确查 Map，没有自动聚合子类键。

因此，在事件仅以子类为键时，存在这种组合：

```text
监听器订阅：ProjectDataEntity
事件中的键：某个 ProjectDataEntity 子类
匹配结果：监听器会执行
监听器读取 getChangeEntities(ProjectDataEntity.class)：可能为空
```

这不是说所有现有监听器都会出错，而是匹配和读取使用了不同契约。测试应构造“只有子类键”的事件，分别断言是否触发以及拿到什么数据。

修订接口时可以提供清晰区分的 `getExactChanges` 和 `getAssignableChanges`，避免调用者自行猜测。

## 事务提交、上下文和对象快照要分开检查

正常的 `IgniteTransactionTemplate` 自建事务路径在提交后发布事件，事务切面也有对应提交后路径。复用外层事务等分支需要继续遵循各自控制流，不能概括为每一次方法调用都会立即发布。

“提交后发布”解决的是不要过早观察未提交数据。它没有保证进程在提交后、通知前崩溃时还能恢复事件，也没有保证业务数据的外部数据库写后持久化已经完成。

线程上下文方面，仓库已有 `ContextPropagatingExecutorService` 和任务装饰器，不能简单断言“线程池一定丢失版本上下文”。但上下文传播也不是事件对象的深拷贝：

`VersionTableChange` 从首个实体取运行时 Class，并保存传入集合。调用者若在提交任务后继续修改集合或实体，异步监听器读到的是哪个时点的数据，需要额外约束。空集合、混合实体类型也属于事件构造契约。

一个更明确的事件载荷可以只带不可变 ID、版本和变更类型，由消费者按版本读取；如果必须带快照，则在发布边界创建独立快照，而不是依赖“已经换线程了”。

## 哪些事件需要可靠交付

重新计算可恢复的界面提示，和驱动不可丢失的业务步骤，对事件的要求不同。

对于前者，记录失败并允许下一次刷新补偿可能足够。对于后者，仅靠内存线程池不够，需要事务性记录、重试、幂等和失败可见性。outbox 可以解决数据库提交与事件记录的一致性，但消费者的幂等、顺序和重放仍要设计。

评审时我会逐个问监听器：丢一次会怎样，执行两次会怎样，晚于下一次变更执行会怎样。答案决定它能否继续留在当前分发器中。

## 验证与源码

基线 `67b9805a064b`，核心模块 `ignite/event/` 下的发布器、事件、变更条目和方法监听器，以及 `IgniteTransactionTemplate`、事务切面、线程池配置共同构成证据。

[实验说明与运行方法](../../examples/engineering-labs/README.md) 包含嵌套任务模型。本文没有执行生产事件处理器、修复事件总线或验证故障恢复。关键结论是：**分发完成、处理完成、处理成功和可恢复交付，需要分别定义。**
