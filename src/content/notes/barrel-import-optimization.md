---
title: "一次 import 优化会丢掉什么：从默认导入到不完整导出映射"
slug: barrel-import-optimization
description: "执行项目的 barrel 包装器与 ResolverBuilder，分析默认导入修复、快速过滤漏判、缺失映射丢符号，以及为什么测试模式要保留包入口。"
status: published
publishedAt: 2026-09-15
topics: [frontend]
kind: decision
updatedAt: 2026-09-16
---

建模前端有大量集中导出入口。页面只用一个组件，却从 index.ts 进入整片模块关系，开发期转换和热更新可能被放大。把导入改写到真实文件，看起来只是路径优化，但它会改变模块执行边界和测试替换边界。

SE-MBSE 中存在两类不同实现：业务目录的 viteBarrelResolutionPlugin，以及内部包使用的 ResolverBuilder。它们不能混为一套“自动按需导入”。本文运行两者的源码快照，检查改写前后保留了什么。

## 先看真正的启用条件

Vite 配置传给业务 barrel 插件的是：

```ts
enable: isDev && process.env.USE_BARREL_RESOLUTION === 'true'
```

只有开发模式且显式打开时生效。另一个 ResolverBuilder 返回的插件写着 `apply: 'serve'`；即便在构建配置数组中能看到它，也不能因此说生产构建一定运行了这个 transform。

测试模式还把 UtilsResolver、UiResolver、PixiChartResolver 等内部包解析器从插件列表中移除。原因体现在源码注释：测试需要保留包入口，让 vi.mock 能隔离图形引擎和接口。

因此测量优化时至少要记录 mode、serve/build、环境开关三项。否则可能拿一个根本没启用的插件讨论性能收益。

## 修复默认导入：为什么拆成两句

包装器调用第三方 resolveBarrelsPlugin，再改写它的 transform。源码说明，底层对混合导入可能丢掉 default：

```ts
import Widget, { helper as h } from '@src/common'
```

包装器先拆成：

```ts
import Widget from '@src/common';
import { helper as h } from '@src/common';
```

然后把结果交给原 transform，并用 call(this, …) 保留插件上下文。

这项修复保护的是 default binding；没有把 default 导入也强行改到命名导出的文件。在我们的实验里，上游插件是“只记录输入”的替身，所以能验证包装器确实保留 Widget 和别名 h，不能据此宣称第三方插件后续输出完全正确。

实际输出：

```text
barrel/wrapper: default-preserved=true, @/common=skipped
```

后半句暴露了另一层边界。

## alias 配置支持，不等于快速过滤允许通过

包装器在调用原 transform 之前先执行 quickCheck：

```text
from + 可选的 @src/、@stores/、@types/、@config/ + 目标目录
```

Vite 配置同时给出了 @ → src 的 alias，但该正则的可选前缀里没有 @/。所以：

```ts
import { helper } from '@src/common' // 通过快速检查
import { helper } from '@/common'   // 本次实验中直接返回 null
```

这里不是应用导入一定失败，而是这项优化没有处理后一种写法。快速过滤为性能服务，却不能比真正的解析规则更窄而不被察觉。解决时应让两者来自同一份路径规范，或者把“未优化”明确记录为诊断信息。

此外 directories 被直接 join 成正则片段。当前目录名简单；如果未来允许点号等字符，必须转义，不能把用户配置当成正则源码。

## 内部包映射不完整，会直接删掉未知导入

ResolverBuilder 的 transformImport 会匹配内部包的具名导入，拆分导入列表，再按 pathMap 分组：

```ts
for (const name of importList) {
  const actualName = name.split(/\s+as\s+/)[0].trim()
  const path = pathMap[actualName]
  if (path) {
    groupedByPath[path] ??= []
    groupedByPath[path].push(name)
  }
}
return generatedStatements.join('\n')
```

注意：没有 path 的符号没有回退分支。输入：

```ts
import { Known, Missing } from '@mbse-unity/demo'
```

映射只含 Known 时，输出只剩 Known。源码隔离实验得到：

```text
resolver/map: Known retained, Missing removed; apply=serve
```

这是比“导出映射可能过期”更具体的行为：旧映射会丢 binding，而不只是降低优化效果。

候选策略有两种：只要一项未解析就保留整句原导入；或把已解析项转成直接导入，同时把剩余项保留在包入口。后一种更细，但要处理类型导入、别名、注释、重复导入和副作用。复杂度增加后，应改用语法树，而不是继续扩大正则。

## 路径改写还会绕过入口副作用

假设包入口包含注册操作：

```ts
import './register-renderers'
export { Chart } from './Chart'
```

若调用方被改写成直接导入 Chart 文件，注册模块可能不再执行。即使 TypeScript 完全通过，运行时也可能缺少某种图形。

这不是对当前 Chart 的故障断言，而是判断转换合法性的必要输入：被绕过的入口是否纯导出？副作用是否被显式提取为初始化入口？同理，测试在原包入口做 mock，而转换器把路径换掉，也会让 mock 失效，这解释了项目为何在 test 模式保留入口。

## 验证转换器，应比较模块含义

当前实验覆盖了默认导入、别名、过滤漏判和缺失映射。真正修改插件时还应为下面这些输入保留固定预期：

```ts
import Default, { Named as Alias } from 'entry'
import type { Shape } from 'entry'
import { type Shape, draw } from 'entry'
import 'entry'
export { draw } from 'entry'
```

验收输出时比较 binding、类型擦除、模块副作用和 mock 命中，不只比较导入语句数量。性能测量再单独固定冷缓存、热缓存、页面和插件开关，记录转换次数与耗时。本文没有运行完整 Vite 性能对照，不编造加速比例。

## 复现与源码

[实验及源码快照](../../examples/engineering-labs/README.md)。barrel 的第三方 transform 被替换，内部 ResolverBuilder 则执行项目原转换代码。

源码：`client/plugins/vite-barrel-resolution.ts`、`client/packages/resolverUtils.ts`、`client/vite.config.ts`、两个图形包的 scripts/resolver.ts；提交 `67b9805a06`。
