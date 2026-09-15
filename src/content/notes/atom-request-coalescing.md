---
title: 三个组件请求同一份数据：用共享 Promise 合并在途请求
slug: atom-request-coalescing
description: 分析 createAtomFetcher 如何区分未加载、加载中与已缓存状态，以及强制刷新、参数变化和缓存身份带来的边界。
status: draft
topics: [frontend, architecture]
kind: architecture
---

在建模页面里，模型树、属性面板和工具栏可能同时需要同一份元数据。如果每个组件挂载后各自请求，即使最终结果相同，网络与解析工作仍会重复。

SE-MBSE 的 `createAtomFetcher` 把请求结果与加载状态放进共享 atom，并把“正在进行的请求”也作为状态管理。这比简单增加一个缓存 Map 更完整。

## 缓存之前，还有一段在途时间

考虑三个调用几乎同时发生：第一个请求已经发出，结果尚未返回；第二个和第三个调用此时都看不到缓存。如果逻辑只是“没有数据就 fetch”，重复请求仍然存在。

当前实现保存 `loadingPromise`。同一个 key 的后续调用，可以直接等待同一个 Promise，而不发出新的请求。

读取顺序被简化为：

```ts
// 依据项目逻辑重写的决策示意
if (state.loadingPromise) return state.loadingPromise;
if (state.inited) return Promise.resolve(state.data);
return executeFetch();
```

这里 `inited` 与 `data` 分开尤其重要。空数组也可能是合法结果，不能用 `data.length === 0` 判断“还没加载”。

## 共享范围由工厂实例和 key 共同决定

`createAtomFetcher` 内部持有一个 `Map`，通过 key 找到 atom。默认 key 来源是请求参数的 JSON 序列化，也允许业务自定义。

因此，共享发生在同一个 fetcher 工厂实例内部。两个独立创建的 fetcher，即使参数相同，也不会因为默认 key 一样就自动共用缓存。

key 还应表达数据身份。如果接口结果依赖工程、分支、版本或权限上下文，只放一个元素 ID 往往不够。请求参数没有显式包含的上下文，不会凭空进入缓存键。

可以先写出一个问题：什么条件变化后，旧结果就不该被复用？把答案逐项映射到 key，通常比等缓存串数据后再修正更可靠。

## 成功与失败应留下不同状态

当前实现成功后写入数据，将 `inited` 置为 true，并清除加载状态与在途 Promise。失败时保留已有状态里的数据，清除加载标记，再抛出异常。

这让首次失败后可以重试，也让已有数据的刷新失败不至于立刻把页面清空。但界面是否显示错误，需要调用方另行处理：这个 atom 状态本身没有独立的 error 字段。

此外，`format` 在写入缓存前统一转换响应，让组件消费同一种结果形状。代价是转换函数也进入请求成功路径，转换失败同样会被当作请求失败处理。

## 强制刷新不等于普通读取

当前 `forceGetData` 与 refresh 会直接执行请求，没有复用正在运行的 Promise。它满足“明确要求重新读取”的语义，也带来重叠请求的可能。

例如，旧请求先开始，新请求后开始但先完成。如果旧请求随后才返回，而写入时没有请求代次判断，就可能覆盖更新的结果。这是从当前路径可推导的并发风险，不代表已经发生线上事故。

可选策略包括：同 key 强制刷新仍只保留一个请求、使用请求序号拒绝旧结果，或者取消旧请求。选择哪一种，要看业务是否允许并发刷新和取消。

## Hook 还要检查参数切换

当前 Hook 会按参数计算 atom，但自动加载 effect 的依赖数组为空。若组件不卸载、参数变化导致切换到新 atom，自动请求是否触发就值得专项验证。

React 会依据 effect 依赖决定何时重新同步；仅仅把最新参数存进 ref，不会自动触发 effect。[React useEffect 文档](https://react.dev/reference/react/useEffect)

我的最小验证集合会包含：三个组件同时读取、空结果缓存、首次失败重试、切换分支、两次刷新逆序返回。这些场景能检验共享语义，而不只是证明一次 fetch 可以成功。

## 实现线索

对应 `createAtomFetcher` 的 `getData`、`executeFetch`、`forceGetData` 和 `useData`。文中示意代码不是完整可替换实现；并发边界依据源码分析，未声称已完成改造。
