---
title: "同一个请求只发一次之后：共享 Promise、刷新竞态与参数切换"
slug: atom-request-coalescing
description: "逐步拆解 createAtomFetcher 的状态迁移，执行源码复现共享 Promise、失败重试、旧响应覆盖与 Hook 参数切换，并给出请求代次方案。"
status: published
publishedAt: 2026-09-15
topics: [frontend, architecture]
kind: architecture
updatedAt: 2026-09-16
---

模型树、属性面板和工具栏都要读取同一份配置。如果各自发请求，问题不只是重复流量：三个组件还会分别经历加载、失败和刷新，最终可能显示不同版本的数据。

SE-MBSE 的 `createAtomFetcher` 把参数映射到共享 atom，再把正在执行的 Promise 存进 atom。这个设计能合并普通读取，却不自动解决强制刷新和参数切换。本文直接运行该函数的源码快照，逐一观察它们的区别。

## 共享范围由工厂实例决定

核心结构位于 `client/src/common/hooks/createAtomFetcher.ts`：

```ts
const cache = new Map<string, PrimitiveAtom<AtomState<T>>>()

const getData = (...params) => {
  const a = getOrCreateAtom(config.key(...params))
  const { loadingPromise, inited, data } = getDefaultStore().get(a)
  if (loadingPromise) return loadingPromise
  if (inited) return Promise.resolve(data)
  return executeFetch(a, ...params)
}
```

Map 创建在工厂函数内部。因此共享单位是“同一个 fetcher 实例、同一个 key”，不是整个应用任意相同 URL。两个模块分别调用一次工厂，即使 fetch 函数和参数相同，也有两个 Map。把工厂放进组件每次渲染执行，还会不断创建新的缓存容器。

合理用法是让一份资源定义拥有一个稳定 fetcher，组件只调用它的 useData。资源身份还应包含实际影响响应的参数，例如工程、分支和查询模式。如果 fetch 从全局变量取工程，但 key 只编码元素 ID，切换工程以后就可能误用旧数据。

默认 key 是 JSON.stringify(params)。它不是领域身份规范：数组中的 undefined 与 null 都可能序列化为 null，对象属性顺序也可能造成不同字符串。涉及复合身份时，应显式确定字段及顺序，而不是把任意对象原样作为协议。

## 同步写入 Promise，才合并得了后一个调用

状态至少包含四项：data、inited、loading、loadingPromise。第一次读取的执行顺序是：

```text
读取 atom：未初始化
调用 config.fetch，得到 Promise
立即将 loading=true、loadingPromise=P 写入 atom
返回 P

第二个读取：
读到 loadingPromise=P
直接返回同一个 P
```

普通成功时，完成回调将 data 写回，设置 inited=true，并清掉 loadingPromise。失败时则保留已有 data/inited，只清理加载状态后重新抛错。

这一区分很实用：初次失败，inited 仍为 false，后续 getData 会重试；已有成功数据后的刷新失败，旧 data 仍能留在界面上。但状态里没有 error 字段，Hook 内自动请求还吞掉了拒绝，因此调用方不能单凭这份状态知道最近一次刷新为何失败。

源码隔离实验的实际输出：

```text
atom/shared: same-promise=true, fetch-count=1
atom/failure: retry-fetch-count=2
```

实验执行原函数编译后的快照，Jotai 由支持 get/set/函数更新的内存替身提供。它验证函数分支，不代表做过真实 React 渲染或网络压测。

## 强制刷新改变了并发协议

forceGetData 没有走上述判断，它直接 executeFetch。因此普通请求 A 尚未结束时，再强制刷新会启动 B，两个完成回调都可以写同一个 atom：

```text
A 开始，请求旧状态
B 开始，请求新状态
B 先结束，atom.data = NEW
A 后结束，atom.data = OLD
```

受控 Promise 实验先 resolve(B)，再 resolve(A)，最终再次 getData：

```text
atom/refresh: NEW completed first, final-cache=OLD
```

这不是“服务器返回顺序偶尔奇怪”。当前代码在成功回调里无条件 store.set，因此任何完成顺序都必须由调用者承担。

失败也存在相似问题：A 是旧请求，B 是当前请求，A 后续失败仍会清掉 loadingPromise。此时 B 实际仍在执行，但 atom 看起来已经不在加载。第三个普通读取可能再次启动请求。

## 请求代次应保护成功和失败两个出口

一种改造是让每个 atom 保存一个递增 requestId，只有当前代次能更新共享状态。以下是方案片段，并非已合入项目：

```ts
const requestId = nextIdFor(a)
markLoading(a, requestId)

try {
  const raw = await Promise.resolve().then(() => config.fetch(...params))
  const data = format(raw)
  if (currentIdFor(a) === requestId) commit(a, data)
  return data
} catch (error) {
  if (currentIdFor(a) === requestId) clearLoading(a)
  throw error
}
```

两个细节不能省略。第一，失败清理也要校验代次，否则旧异常仍会覆盖新请求的状态。第二，旧 Promise 的调用者仍可能收到自己的结果；“不提交旧结果到共享缓存”与“取消旧调用”是两个不同决定。若业务要求旧调用直接终止，需要另行定义取消信号和错误类型。

把 fetch 放在 Promise 链里，还能统一处理同步抛错。原实现先直接调用 config.fetch，再注册 then/catch；若 fetch 在返回 Promise 前就 throw，错误不会进入后面的状态清理链。类型声明 Promise 返回值并不阻止实现同步抛错。

## 参数变了，effect 为什么没再次请求

Hook 每次渲染都会计算新 key，并取得新的 atom，但请求 effect 的依赖是空数组：

```ts
const a = getOrCreateAtom(config.key(...params))
const paramsRef = useRef(params)
paramsRef.current = params

useEffect(() => {
  tryFetch(a, ...params)
}, [])
```

组件从 A 切到 B，订阅对象变成 atom(B)，effect 却不重新执行。如果 B 之前没有加载，就停在 initialData。实际隔离输出：

```text
atom/params: requested=A, B.inited=false
```

这不是需要重新执行整个工厂，而是应让加载生命周期与资源身份对齐。可让 effect 依赖稳定的 atom 身份 a，并从 paramsRef 读取本次参数。前提是 key 能完整表达资源身份；如果 key 漏字段，同一个 a 内部切换参数仍然不可靠。

## 还需要定义缓存的离开方式

当前工厂 Map 没有容量限制、失效入口或用户切换时的清理机制。对于少量静态字典这可能足够；对于不断增长的工程与元素组合，Map 会随访问范围增长。应先区分资源寿命，再决定做手工 invalidate、带引用计数的回收，还是限制容量，不能仅靠组件卸载判断，因为其他组件可能仍在使用同一 atom。

这份实现的价值在于把“普通读取正在进行”表示成可共享状态。要让它承担编辑器中的长期数据层，还需要一起定义强刷代次、参数切换、失败可见性和缓存回收。

## 复现与源码

[实验入口与说明](../../examples/engineering-labs/README.md)，运行 `node verify.mjs`。源码快照、替身范围及校验值随实验提供。本篇对应输出前四项；没有修改生产 fetcher。

源码：`client/src/common/hooks/createAtomFetcher.ts`，快照提交 `67b9805a06`。
