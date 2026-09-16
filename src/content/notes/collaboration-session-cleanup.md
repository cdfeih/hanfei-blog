---
title: "ConcurrentHashMap 也会丢会话：检查、移除与用户离线的三个边界"
slug: collaboration-session-cleanup
description: "从协作会话清理的具体交错出发，分析复合操作原子性、多标签页离线语义，以及定时清理为什么不能代替完整资源释放。"
status: published
publishedAt: 2026-09-15
topics: [modeling, architecture]
kind: architecture
updatedAt: 2026-09-16
---

一个用户关闭建模页面后，服务器要删除会话、更新协作名单、释放撤销栈和仿真资源。困难在于：同一个用户可能还有另一个标签页，旧连接正在退出时，新连接也可能刚刚加入。

SE-MBSE 的 `CollaborativeSessionManager` 使用 `ConcurrentHashMap<String, Set<WebSocketSession>>` 管理工程和文档会话。外层 Map 与内部 Set 都支持并发操作，但一次“退出工程”需要多步状态变化。**容器线程安全，不能代替整个业务操作的原子性。**

## 先把三个身份区分开

工程协作分组按项目、分支、版本组织；文档分组在工程范围内进一步关联文档。一个会话 ID 对应一条连接，用户 ID 则可能对应多条连接。

| 身份 | 典型资源 | 什么时候可以清理 |
| --- | --- | --- |
| 会话 | 该连接的撤销/重做栈 | 这个会话退出 |
| 工程协作分组 | 该分支版本的冲突处理状态 | 该分组确实没有会话 |
| 项目中的用户 | 项目级离线通知 | 同用户在该项目中没有其他活动会话 |

把这三层混成“用户断开了”，容易误删仍被另一个标签页使用的资源。

## 已有原子路径怎样处理加入和移除

`addSessionToGroup` 使用 Map 的 `compute`，在回调内创建 Set 并加入会话。`removeSessionFromGroup` 使用 `computeIfPresent`，在同一个回调里移除目标会话、判断是否为空，为空则返回 null 删除映射。

简化后是：

```java
groups.computeIfPresent(key, (k, sessions) -> {
    sessions.removeIf(current -> current.equals(leaving));
    return sessions.isEmpty() ? null : sessions;
});
```

同一个键的加入与移除都走这条约定时，Map 级更新提供了明确的串行化边界。[ConcurrentHashMap 文档](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ConcurrentHashMap.html) 说明了计算操作的原子性；它没有承诺两个 Map 或外部资源一起构成事务。

## 另一条清理路径绕开了这条边界

`clearSession` 的做法不同：遍历各组，先从 Set 删除会话，把空组的 key 存入列表，随后再遍历列表执行 `map.remove(key)`。

下面的交错不需要容器发生任何内部错误：

```text
初始：groups[K] = {oldSession}

清理线程 C：移除 oldSession
清理线程 C：看到 Set 为空，将 K 加入待删除列表
加入线程 J：compute(K)，把 newSession 加入原 Set
清理线程 C：根据旧判断执行 groups.remove(K)

结果：newSession 仍可能是打开的，但分组映射已经不存在
```

实验包用显式阶段控制模拟这个顺序，结果为：

```text
sessions/check-then-remove: newly-added-session-lost=true
```

这是独立集合模型，不是生产 Java 类的并发压测。它证明该交错可以导致什么；当前源码的“先检查，后删除”则提供了适用条件。

把最后一步改成 `remove(key, oldSet)` 也未必够：新会话可能加入的就是同一个 Set，对象身份没有变化。要解决的是“判断为空”和“删除映射”之间的窗口。

## 把 Map 修好以后，资源释放还剩一个窗口

统一走现有 `computeIfPresent` 是必要的局部修订，但不是完整证明。

例如移除返回“分组已空”，调用方随后执行 `conflictResolver.clearCanvasMap(key)`。如果新会话在这两步之间重新创建了同名分组，清理动作会不会碰到新一代分组的冲突状态？

这取决于冲突处理器的资源标识和初始化协议，不能只看 Map 就宣告问题解决。可以考虑为分组加 generation，释放资源时校验代际，或把分组状态与资源生命周期放进统一的管理对象。不要为了原子性把慢速广播、网络调用全部塞进 Map 的计算回调。

这属于进一步设计建议，本文没有修改现有协作实现。

## 关闭一个标签页，是否应该广播用户离线

当前代码的 `publishProjectUserOfflineEventIfNeeded` 会调用 `hasActiveSessionInProject(projectId, userId)`。它按项目 ID 前缀扫描所有分组，检查同用户是否还有打开的会话。

因此可构造以下验收场景：

```text
用户 U 在项目 P：
  标签页 A：分支 main，版本 10
  标签页 B：分支 test，版本 20

关闭 A：
  清理 A 的撤销栈
  更新 A 所属分组名单
  B 仍打开，因此不应宣告 U 已离开项目 P
```

这个项目级检查比“当前分组空了就离线”更准确。但它仍是当前进程内的一次并发扫描，不是全系统持久化在线状态；如果未来跨实例管理会话，需要另外定义全局判定。

## 定时清理并不覆盖整个退出流程

源码用 `scheduleWithFixedDelay` 启动过期会话清理：初始延迟两分钟，后续在上次执行结束后间隔三分钟。它并不是严格每个整三分钟触发一次。

定时路径会清除关闭的会话以及空组的冲突状态；完整 `clearSession` 还包含撤销栈清理、离线事件、仿真资源处理与线程上下文清理。不能因为存在定时任务，就推断所有遗漏资源都会自动补偿。

完整路径尾部的上下文清理也值得检查：它当前按顺序执行，没有包在该方法的 `finally` 中。前面的步骤若抛异常，后续步骤可能跳过。清理设计宜把必须执行的本地释放放进可靠的收尾路径，把可重试的通知和外部释放分别记录状态，避免一个广播异常阻断所有资源回收。

## 真正需要固定下来的回归场景

我会用屏障控制线程交错，而不是靠随机睡眠：

1. 清理停在“观察到空组”后，再让新会话加入，最后继续删除。
2. 同用户两个会话退出其中一个，检查用户级离线事件次数。
3. 同一会话清理两次，验证撤销栈、仿真释放和事件的幂等边界。
4. 在广播处注入异常，检查上下文与本地资源是否仍被释放。
5. 分组删除后立即同 key 重建，检查旧清理动作是否影响新分组。

源码基线为 `67b9805a064b`，入口是项目 service 的 `project/websocket/CollaborativeSessionManager.java`。[独立实验](../../examples/engineering-labs/README.md) 已运行；完整 Java 多线程、WebSocket 和仿真资源集成测试未执行。
