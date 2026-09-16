---
title: "把字典服务拆出去之前：沿一次缓存失效检查模块边界"
slug: modular-monolith-api-service
description: "从 DictCacheManager 的 Dubbo 调用和 Spring 本地事件出发，解释 API、实现与部署边界为什么需要分开检查，并给出可执行的拆分验收场景。"
status: published
publishedAt: 2026-09-15
topics: [architecture, management]
kind: architecture
updatedAt: 2026-09-16
---

一个后端分成 API、service、web 三层，并不能直接说明它已经具备独立部署能力。我在 SE-MBSE 中选了一条很短的链路检查这件事：**项目模块显示一个字典标签，系统模块修改它之后，项目模块怎样读到新值？**

这条链路同时经过接口、数据库查询、本地缓存和事件。只看接口定义，很容易漏掉后半段。

## 先确定当前进程里装了什么

`server/pom.xml` 聚合业务模块，`mbse-platform-web/pom.xml` 引入系统、项目、需求、知识、适配等 service 模块，再由启动模块组装应用。基础配置中的 `dubbo.protocol.name=injvm` 表明这套默认配置采用进程内协议；具体环境仍可能覆盖它。

`DubboConfig` 在对应开关启用时扫描服务组件。因此这里至少有三张不同的图：

| 检查对象 | 能回答的问题 | 不能自动保证的事情 |
| --- | --- | --- |
| Maven 依赖 | 哪个模块能编译引用哪个类型 | 运行时没有共享状态 |
| Dubbo 接口调用 | 消费者通过什么契约获取数据 | 失败、延迟与本地调用相同 |
| 应用进程与本地事件 | 哪些缓存能收到一次失效通知 | 拆成两个进程仍能通知 |

文章以下结论来自当前源码与默认组装方式，没有把所有部署环境都当成相同拓扑。

## 沿一次字典读取走到提供者

项目侧入口是 `DictCacheManager`。它用字典项 ID 作为本地 Guava 缓存键，通过 `@DubboReference` 持有 `SysDictExternalService`。

调用关系可以压缩成：

```text
项目展示需要字典标签
  → DictCacheManager
      → 本地缓存命中：直接返回
      → 未命中：SysDictExternalService.getDictItemById(id)
          → SysDictExternalServiceApiImpl
              → ISysDictService.findById(id)
              → SysDictItemExternalDTO
      → 复制 id / label / value，放入本地缓存
```

提供者使用 `@DubboService(interfaceClass = SysDictExternalService.class)` 暴露 API。项目模块接触的是 DTO，没有直接接触系统模块的数据库实体。这是一个已经存在的契约边界。

批量读取也值得保留：缓存的 `loadAll` 对接 `getDictItemByIds`。提供者过滤空 ID、去重后执行批量查询。若调用迁移到网络上，批量入口能避免把一次界面渲染变成几十次逐项 RPC；但减少调用次数并不等于已经证明吞吐量提升。

## 真正容易漏掉的是失效通知

系统模块修改或删除字典项时，`SysDictServiceImpl` 发布 `DictItemsChangedEvent`。项目侧不是通过 Dubbo 订阅这个事件，而是用 Spring 的 `@EventListener` 接收它，再使对应 ID 的本地缓存失效。

```text
修改字典
  → 系统模块持久化
  → 发布 DictItemsChangedEvent(changedIds)
  → 同一应用上下文内的 DictCacheManager 收到事件
  → invalidate(changedIds)
  → 下一次读取重新走 API
```

这就出现了第二条依赖：**读取通过服务接口，保持新鲜度依赖本地事件。** API 包同时容纳事件类型，只解决了类型可见性，没有提供跨进程运输能力。

假设把系统服务放进进程 S，把项目服务放进进程 P，只把 Dubbo 地址配通：

1. P 读取 ID=42，缓存标签“旧名称”。
2. S 将标签改为“新名称”，发布自己的 Spring 事件。
3. P 的旧缓存仍然命中，没有触发 RPC。
4. 等缓存过期或有其他失效动作后，P 才重新读到新值。

远程接口健康检查可以全部通过，界面仍然显示旧名称。这是由依赖关系推导出的拆分风险，本文没有实际拆服务复现，也没有将它写成已发生的线上事故。

## 一个能识别边界是否完整的验收用例

验证时应把进程拓扑纳入测试输入，而不只检查 API 返回值：

```text
准备：两个独立应用上下文，共享同一测试数据源
P：读取字典 42，确认缓存已填充
S：更新字典 42
P：再次读取，记录是否发生接口调用及返回标签

追加：
- 更新提交失败时，是否发出通知？
- 通知重复时，失效是否幂等？
- P 暂停接收通知后恢复，怎样补齐遗漏？
- 两个 P 实例是否都会失效？
```

这里“两个独立应用上下文”是最低隔离要求，完整部署验收还应使用独立进程。把两个模块放进同一个 Spring 测试上下文，会恰好掩盖要找的问题。

当前源码中出现了事件发布，不能据此推定它与数据库提交形成了原子交付；事务时机和异常分支要单独检查。

## 如果确实需要拆，先补哪一段

我会先把一致性目标写成可验证的约束，例如“更新成功后，在约定时间内所有展示实例不得再返回旧标签”。然后再选实现：

- 如果业务容许短暂陈旧，可保留 TTL，但把允许的陈旧窗口写进产品行为。
- 如果更新必须主动传播，可采用持久化变更记录或 outbox，提交后转发带事件 ID、字典 ID 和版本的通知。
- 消费端按 ID 失效，并处理重复、乱序和离线恢复。只发送一次非持久化消息，仍然可能遗漏。

还需要考虑“旧请求晚到”：实例正在读取旧值时收到了失效事件，随后旧请求完成，又把旧值填回缓存。解决跨进程通知并不会自动解决这类缓存回填竞态。版本检查或每个键的代际计数，应与加载路径一起设计。

这些是拆分方案，不是当前仓库已经具备的能力。

## 这条链路带来的架构判断

当前 API/实现分离已经能减少实体和持久化细节向调用方泄漏；启动模块集中组装，也有利于在一个进程里维护业务一致性。是否独立部署，需要继续验证本地事件、事务、缓存、上下文和故障恢复是否跨得过进程边界。

对技术负责人而言，评审时最有价值的材料是一条“修改后怎么生效”的完整路径。它比模块数量更能说明拆分还欠什么工作。

## 源码定位与验证范围

源码基线为 `67b9805a064b`，主要入口：

- `server/mbse-platform-web/pom.xml`：最终服务组装。
- `core/dubbo/DubboConfig.java`：这里及下文的 core 指核心模块 Java 包。
- `project/metamodel/cache/manager/DictCacheManager.java`：本地缓存、批量加载与事件失效。
- 系统 API 的 `SysDictExternalService`、`DictItemsChangedEvent`。
- 系统实现的 `SysDictExternalServiceApiImpl`、`SysDictServiceImpl`。

本文完成了静态调用链核对，没有执行多进程拆分或数据库事务实验。完整模块路径及文件指纹保留在本轮文章的核验记录中。
