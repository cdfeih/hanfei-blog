---
title: "页面切走了，许可申请才成功：把浮动许可当成异步资源管理"
slug: floating-license-lifecycle
description: "从 LicenseGuard 与 useModelingLicense 的实际差异出发，复现框架切换时旧响应覆盖新权限，并推导取消、补偿释放和服务端租约身份。"
status: published
publishedAt: 2026-09-15
topics: [frontend, architecture]
kind: architecture
updatedAt: 2026-09-16
---

一个许可 Hook 写起来很短：进入页面申请，离开页面归还。但网络请求不会随页面生命周期自动停止。如果申请尚未完成就离开，先发出的归还与迟到的申请怎样对应？如果从框架 A 切到 B，A 的成功响应是否会放开 B 的操作？

SE-MBSE 的两个入口正好能用来分析这些问题。下面区分界面状态、客户端生命周期和服务端许可协议，不把“隐藏一个按钮”当作已经完成席位管理。

## 两个入口有不同的初始行为

`LicenseGuard` 初始 licenseState=1，先渲染 children，服务端拒绝或请求失败后才显示 NoLicense。effect 的依赖为空，清理时调用 restoreLicense(license)。

`useModelingLicense` 初始 isAllowed=false；disabled 为真时允许查看并直接返回，不申请许可；否则申请 frameCode，在 effect 清理时归还。依赖包括 disabled 与 frameCode。

| 情况 | LicenseGuard | useModelingLicense |
| --- | --- | --- |
| 申请未完成 | 默认展示内容 | 首次挂载默认不允许 |
| 只读模式 | 此入口未表达该条件 | disabled=true 直接允许 |
| 许可标识变化 | 同一实例的空依赖 effect 不重跑 | 清理旧 effect，再申请新许可 |
| 申请失败 | 展示无许可页 | isAllowed=false |

路由构建器给 Guard 设置了包含许可和路径的 key，可以通过重新挂载触发生命周期；不能把“effect 空依赖”单独当作所有路由都不会更新。但直接复用同一组件实例时，仍需明确 key 或依赖如何变化。

Guard 的乐观显示适合怎样的用户体验，应由产品决定；写操作是否合法，仍需要服务端判断。本文未检查完整服务端权限链，不据此前端行为推断越权。

## 从 A 切到 B，旧 Promise 不会自动作废

Hook 的核心逻辑是：

```ts
useEffect(() => {
  if (disabled) {
    setIsAllowed(true)
    return
  }
  wsStore.consumeLicense(frameCode)
    .then(res => setIsAllowed(res.code === 200))
    .catch(() => setIsAllowed(false))

  return () => {
    wsStore.restoreLicense(frameCode)
  }
}, [disabled, setIsAllowed, frameCode])
```

A 申请未完成时切到 B，会执行 A 的清理并启动 B 的申请，但 A 的 then 仍然存在：

```text
申请 A
切换 B：发出归还 A，申请 B
B 返回拒绝：isAllowed=false
A 迟到成功：isAllowed=true
当前屏幕仍然是 B
```

我们执行原 Hook 的编译快照，用替身控制 effect 清理和 Promise 完成顺序，得到：

```text
license/late-response: B denied, then A success => B.allowed=true
```

这是 Hook 函数体的隔离验证，没有运行真实 React DOM，也没有向许可服务发送请求。

还有一个较短的窗口：A 已成功后切到 B，effect 没在开始时先把 isAllowed 置为 false。因此 B 的结果到达前，界面会暂时沿用 A 的 true。仅过滤迟到结果还不够，还要定义新资源进入 pending 时怎样展示。

## 忽略旧响应，只解决界面状态

用 effect 内的 disposed 标志可以避免卸载后更新状态：

```ts
useEffect(() => {
  let disposed = false
  setState({ status: 'pending', frameCode })
  acquire(frameCode).then(result => {
    if (!disposed) setState(toState(result))
  })
  return () => { disposed = true }
}, [frameCode])
```

这是候选片段，不是完整修复。若服务端已经授予席位，只忽略成功响应会泄漏远端资源。问题要拆成两个动作：

1. 这个响应还能不能更新当前界面？
2. 它代表的许可是否已经取得，是否需要补偿归还？

两个问题不能都靠 setState 解决。需要让申请结果携带足以识别占用的身份，清理时取消未完成申请，或者在迟到成功后归还那次申请实际取得的占用。

## 为什么只靠 moduleCode 不够表达完整生命周期

当前客户端发送的是 LicenseEnter/LicenseLeave 加 moduleCode，没有在这一层看到独立 leaseId。服务端是否另有会话计数或幂等机制，需要继续核对其实现；不能从客户端参数直接判定席位一定泄漏。

但一个能处理乱序和重试的协议至少要回答：

```text
acquire(moduleCode, requestId, sessionGeneration)
    → granted(leaseId, expiresAt)

release(leaseId, operationId)
    → released 或 alreadyReleased
```

requestId 用来识别重试是不是同一次申请，leaseId 识别具体占用，sessionGeneration 区分重连前后的会话。这里是协议设计示意，没有宣称项目已经提供这些字段。

如果服务端按“用户+模块”共享一个席位，两个标签页同时进入时，关闭其中一个不能直接释放另一个仍使用的资源。这时可采用服务端会话集合或引用计数，但必须明确计数由哪一端维护，以及异常断链后如何回收。

## 释放失败必须进入资源状态，而不只是控制台

当前清理调用 restoreLicense，没有 await，也没有显式处理拒绝。React effect 清理本身不能靠等待远端响应来阻塞卸载，因此归还应交给独立资源管理器，记录 releasing/released/failed，而不是要求页面留在原地。

网络失败时可以重试幂等 release；长时间失联则需要服务端租期或连接回收作为兜底。不能靠页面 unload 一次发送来保证每次归还都到达。

这里还依赖传输层：wsStore.beforeSend 会等待连接成功；底层 sendAsPromise 的本地超时来自第三个参数，而目前许可调用把 timeout 放进消息体。因此“清理已经调用了归还函数”与“归还已发出、已成功”之间存在多个状态。传输层细节见[WebSocket 重连分析](../websocket-reconnect-state-machine/)。

## 如何把组件代码变薄

建议由一个许可管理器持有申请状态、requestId、leaseId、取消与重试。组件只订阅某资源的状态：

```text
idle → acquiring → granted → releasing → released
             ↓         ↓
           denied    expired
             ↓
            error
```

切换 A 到 B 时，组件解绑 A 并绑定 B；A 的迟到结果由管理器负责补偿，不再修改 B 的状态。对只读模式，可以绑定“不需要占用”的视图状态，但不能复用其他许可的 granted 标志。

验收重点不是“申请成功按钮亮了”，而是精确控制顺序：申请 A 后切 B；B 拒绝后 A 成功；释放先到申请后到；同用户两个标签页先后退出；重连后收到旧会话响应。只有每个顺序都能解释席位归属，页面生命周期才与资源生命周期对齐。

## 复现与源码

[源码隔离实验](../../examples/engineering-labs/README.md)包含旧响应覆盖断言。源码：`client/src/routes/guard.tsx`、`client/src/stores/wsStore.ts`、`client/packages/utils/src/websocket/websocket.ts`，提交 `67b9805a06`。文中的租约协议属于候选设计，未修改服务端许可实现。
