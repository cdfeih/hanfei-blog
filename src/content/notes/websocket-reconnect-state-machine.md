---
title: "重连定时器执行了，连接为什么没恢复：拆开 WebSocket 的两层生命周期"
slug: websocket-reconnect-state-machine
description: "联合分析 wsStore 与底层 Websocket，用源码隔离实验验证实例守卫、重连条件、请求超时参数和连接等待，并设计单一重连责任。"
status: published
publishedAt: 2026-09-15
topics: [frontend, architecture]
kind: decision
updatedAt: 2026-09-16
---

看到“第 1 次重连”的日志，不代表浏览器创建了新连接。SE-MBSE 的系统消息通道分成两层：wsStore 管理业务状态与许可请求，utils/Websocket 管理原生连接和消息 Promise。必须把两层放到同一张时序图里，才能解释一次断开之后真正执行了什么。

本文运行的是这两层的源码快照，原生 WebSocket 和定时器由可控制的替身提供；结论描述当前代码分支，不冒充实际网络故障测试。

## 上层判断实例存在，下层判断连接状态

wsStore.init 的第一句是：

```ts
if (this.wsInstance) return
```

首次调用会创建底层包装器；包装器构造器再调用 connect，创建原生 WebSocket。连接关闭后，上层只将 connected 置为 false，没有清空 wsInstance。

生产环境下，上层还会弹出要求重连的提示，并调用 attemptReconnect。定时器触发后增加尝试次数、扩大下次延迟，再调用 init：

```text
原生 onclose
  → wsStore.connected = false
  → attemptReconnect 安排 timer
  → timer 执行，日志打印“第 1 次重连”
  → init
  → wsInstance 仍存在，直接 return
```

隔离实验让首个原生连接关闭，再手动执行 timer：

```text
socket/store-retry: timer-fired=true, native-sockets=1
```

新原生连接数量仍为一。问题出在“已经有包装器”和“有可用连接”被当成了同一个条件。

开发模式还有另一条分支：上层 onClose 在记录日志后直接 return，不进入重连弹窗和 attemptReconnect。因此只在开发环境测试，无法覆盖生产分支的行为。

## 底层也有重连，但条件与注释相反

继续阅读 `client/packages/utils/src/websocket/websocket.ts`。它有自己的 tryInterval，默认 5000；onclose 中的相关条件是：

```ts
if (this.tryInterval <= 0) {
  if (this.timer) {
    clearTimeout(this.timer)
    this.timer = null
    return
  }
  this.timer = setTimeout(() => this.connect(), this.tryInterval)
}
```

注释说小于等于零不重连，代码却只在小于等于零时进入定时器分支。源码实验得到：

```text
socket/default-close: reconnect-timers=0
socket/interval-zero: reconnect-delay=0
```

默认 5000 不安排底层重连，设置 0 却安排零延迟任务。不能以为“上层 init 返回了，但底层总会自己重连”。

这里应先决定重连由谁拥有，再调整条件。只修反向判断，可能变成上层和底层同时调度，出现重复连接、旧回调覆盖新状态等另一组问题。

## 指数退避计算正确，不代表循环存在

上层配置 min=1000、max=10000、最大尝试 10 次。若有完整循环，其等待序列应为：

```text
1000 → 2000 → 4000 → 8000 → 10000 → …
```

但当前 attemptReconnect 每次只安排一个任务；下一次通常还依赖新连接的 onclose 再次触发。如果根本没有新连接，计数和延迟就不会自动产生后续尝试。

另外 onOpen 重置了尝试计数和 min/max，但没有直接重置 reconnectDelay。实现完整循环时，还需决定连接成功后是否恢复基础延迟，以及短暂连上立即断开是否算真正恢复。

## 业务请求的 timeout 没有传到计时器

上层许可调用看起来配置了三秒超时：

```ts
this.wsInstance.sendAsPromise({
  type: EWebsocketMessageTypeEnum.LicenseEnter,
  data: { moduleCode },
  timeout: 3000,
})
```

但底层签名是：

```ts
sendAsPromise(message: object, msgId?: string, timeout?: number)
```

底层计时器读取第三个参数，不读取 message.timeout。字段只是被 JSON.stringify 后发给服务端。本地 timeout 默认是 -1，因此这个调用没有设置客户端响应计时器。实验输出：

```text
socket/timeout: payload-field=0 timers, third-argument=1 timer
```

底层开发分支还明确不创建响应超时。修正方式应先定义参数协议，例如 `sendAsPromise(message, undefined, 3000)`，或者改成统一 options 对象，避免请求体和本地控制参数共用层级。

还不能就此断言服务端完全不处理消息体中的 timeout；本实验只确认客户端计时器没有读它。

## 三秒响应超时，也管不了连接前等待

许可调用先 await beforeSend，再发送消息。beforeSend 在 connected=false 时订阅 ConnectKey 成功事件，但没有失败事件、超时和取消出口。

所以等待分成两段：

```text
等待连接可用          等待服务端响应
[ beforeSend …… ] → [ sendAsPromise …… ]
```

即使修复 sendAsPromise 的超时，第一段仍可能一直挂着。用户离开页面后，旧许可申请还可能继续等到重连，届时再发出去。Observer 的成功监听也没有在 resolve 后注销，反复调用可能累积已经失去用途的回调。

更合适的接口是共享一个连接 Promise，明确 ready、failed、closed 三种终态，并支持 AbortSignal。连接代次变化时，把属于旧代次的待发送请求拒绝或重新判定，不能静默发送到新会话。

## 一个状态机应同时约束实例和等待者

候选状态如下：

```text
idle → connecting → open
           ↓          ↓
          retry-wait ←┘
               ↓
           connecting
任意状态 → stopped（用户主动关闭）
```

约束比状态名称更重要：

- connecting 只允许一个原生实例和一个共享连接 Promise。
- retry-wait 只允许一个 timer；进入 stopped 必须取消 timer。
- 每个连接有 generation，旧实例的 onclose 不能关闭新实例的状态。
- open 只说明传输可用；工程订阅、许可和协同状态需要各自恢复协议。
- 主动关闭先写入 stopped，再关闭 socket，避免关闭回调误判为网络失败。

底层当前还出现 `this.onError = this.onError`，它没有给原生 ws.onerror 赋值。错误反馈链要沿赋值目标检查，不能只因为构造参数里有 onError 就认定已经接通。

这一轮没有修改生产连接实现。真正接入前，应使用真实浏览器分别验证握手失败、服务端关闭、网络恢复和主动退出，确认网络事件与上述受控调度一致。

## 复现与源码

[可运行实验](../../examples/engineering-labs/README.md)包含原生连接数量、timer 数量和参数传递断言。假连接不发送网络请求，假定时器由测试显式触发。

源码：`client/src/stores/wsStore.ts`、`client/packages/utils/src/websocket/websocket.ts`、`client/packages/utils/src/observers/obser.ts`；提交 `67b9805a06`。
