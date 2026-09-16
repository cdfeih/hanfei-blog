---
title: "拆成五个包以后，边界真的成立了吗：追踪建模前端的三种依赖图"
slug: pnpm-workspace-boundaries
description: "根据工作区、包清单与 Vite 解析器区分安装、源码和构建三种依赖关系，说明本地引擎例外、React 单实例和包入口验收。"
status: published
publishedAt: 2026-09-15
topics: [frontend, architecture]
kind: architecture
updatedAt: 2026-09-16
---

把目录移到 packages 下面，不能自动得到可独立维护的组件库。开发应用可能通过源码 alias 直接运行，而包的 dist 从未构建；包清单可能只依赖接口，实际源码却反向引用应用状态。只看一张 package.json 依赖图，容易把这些问题藏起来。

SE-MBSE 当前工作区适合具体说明这种差异。对本次快照的直接 packages 子目录按 package.json 核对，排除 pixijs-source 后，有五个包：icons、pixichart、react-pixichart、ui、utils。这个数字是文件清单统计，不代表整个仓库只有五个技术模块。

## 安装图：workspace 与 file 表达不同关系

pnpm-workspace.yaml 的相关配置是：

```yaml
packages:
  - packages/*
  - '!packages/pixijs-source'
```

图形部分的依赖关系由包清单给出：

```text
react-pixichart
  └─ @mbse-unity/pixichart: workspace:*
       └─ pixi.js: file:../pixijs-source/bundles/pixi.js
```

workspace:* 让 React 适配层明确依赖工作区里的绘图包。定制 PixiJS 源码树则被排除出该工作区枚举，pixichart 用 file 依赖指向它的 bundle 子目录。

这个例外说明，引擎源码树和应用工作区不必强行使用同一套包组织方式。但是团队需要知道谁负责生成引擎产物、哪些文件必须在 checkout 中存在，以及 package.json 指向源码还是已构建产物。

React 适配包还提供单独的 build:pixijs-source 脚本，进入源码树运行 build 和 build:types。它的存在不等于执行普通应用开发命令时总会自动完成这两步。

## 源码图：开发服务器可能绕过发布入口

应用 Vite 配置直接 alias 内部包源码，并安装若干导入解析器。React 适配包自己的清单则声明：

```json
{
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"]
}
```

因此至少有两条不同路径：

```text
应用开发：包名 → Vite alias / resolver → src 内部文件
包消费者：包名 → module/types → dist 文件
```

在开发环境改一个源码文件立刻生效，并不能证明 dist 已更新，或者包消费者能得到相同导出。一个常见的具体失败是：开发器读 src 中新加的 ExportX，所以页面正常；打包发布时 dist/index.d.ts 尚未包含 ExportX，外部消费者却编译失败。

这里不需要靠发布到远端验证。可以把包构建产物打成临时压缩包，在独立的最小消费者目录安装，分别执行类型检查和一次导入。该消费者不能继承 monorepo 的路径 alias，否则又绕回源码。

## 框架依赖：peer 与 overrides 的职责不同

react-pixichart 将 React 和 ReactDOM 声明为 peerDependencies，同时在 devDependencies 中保留开发测试依赖。工作区根部又通过 overrides 统一它们的版本约束。

两者解决不同问题：

- peer 声明“使用我的应用应提供兼容的 React”。
- dev dependency 让包自身的 Storybook、构建和类型检查能运行。
- root overrides 控制本工作区依赖解析，不能替包消费者决定安装结果。

当前约束 `^19.2.3` 不能解释为“只能使用 19.2.x”；它允许同一主版本中满足范围的后续版本。实际安装结果仍要看锁文件，升级时也要一起核对 React 类型包。这里没有把源码注释里的版本描述直接当成安装事实。

为什么强调单实例？React 适配层拥有组件生命周期，应用拥有渲染根；若两边使用不同的运行时身份，类型兼容不等于运行时兼容。这类依赖更适合由消费应用提供，并在包产物中保持外部引用。

## 构建图：三个 build 不是同一种产物

当前 pixichart 使用自己的构建命令，react-pixichart 用 Father 产出包，并用 Storybook 展示组件；应用本身由 Vite 构建。测试模式又刻意跳过内部包导入转换，以保留 vi.mock 边界。

所以边界验收需要覆盖：

| 入口 | 实际要证明的事情 |
| --- | --- |
| 应用开发页 | 源码解析、HMR 和本地引擎可协作 |
| 包自身类型检查 | 对外类型不依赖应用私有 alias |
| 最小包消费者 | module、types、files 与产物一致 |
| 组件测试 | mock 命中约定入口，没有被解析器绕过 |

一个入口成功不应替其他入口背书。检查次数可以按变化范围选择：只改业务页不必重跑所有包，但修改包导出、构建或 peer 约束时，消费者验证就直接相关。

## 用一次图形能力扩展确定职责

假设增加“框选后整体缩放”功能。可将问题按输入和所有权拆开：

```text
应用：决定哪些模型元素允许被缩放、怎样提交领域命令
React 适配：把组件属性与事件连接到图形实例生命周期
pixichart：计算几何变化、命中与绘制交互
PixiJS：执行底层渲染
```

这是针对该功能的职责建议，不是宣称当前所有代码都严格符合这张图。验证是否符合，要检查绘图包有没有导入 appModeling、路由或业务 store；反向依赖出现时，不能仅靠“它在 packages 中”认定解耦完成。

回调、命令接口和独立的数据结构通常比让绘图包直接获取全局 store 更容易维护。代价是调用方要显式传递上下文，但这种成本能在类型与测试中看见，而不是藏成运行时前提。

## 可核对的交付标准

这轮按文件核对了工作区五个直接包、图形依赖链、peer 声明、构建脚本和应用解析路径。没有执行全工作区构建，也没有声称消除了所有循环依赖。

对于后续拆包，建议交付一条能重复执行的证据链：选定公开入口，构建实际发布文件，用不带应用 alias 的消费者导入，再检查运行期只使用约定的框架与引擎实例。包的数量不重要，能否独立解释这些行为才重要。

源码：`client/pnpm-workspace.yaml`、`client/packages/pixichart/package.json`、`client/packages/reactPixichart/package.json`、`client/packages/resolverUtils.ts`、`client/vite.config.ts`；快照 `67b9805a06`。实际包版本应以当前锁文件为准。
