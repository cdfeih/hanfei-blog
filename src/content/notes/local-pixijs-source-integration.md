---
title: "接入本地 PixiJS 不能只改一个 alias：入口、子包、Shader 与 Worker"
slug: local-pixijs-source-integration
description: "拆解当前 Vite 的本地引擎解析链，说明 53 个子包别名、GLSL 文本转换、worker 前缀适配，以及开发入口与包产物的差异。"
status: published
publishedAt: 2026-09-15
topics: [frontend, modeling]
kind: decision
updatedAt: 2026-09-16
---

定制图形引擎接入应用时，最迷惑的现象是“主入口已经指向本地源码，但某部分修改始终不生效”。原因可能不是缓存，而是引擎内部的子包仍从另一份依赖解析，或者 Shader、Worker 根本没进入同一条构建链。

SE-MBSE 当前配置固定使用 PixiJS source 模式。本文沿配置的实际执行位置拆开四类模块，不把旧文档中的“生产切 dist”当作现状。

## 主入口只解决第一跳

Vite 中 pixi.js 的替换目标是：

```text
packages/pixijs-source/bundles/pixi.js/src/index.ts
```

配置将 PixiMode 限定为 source，实例也固定取 source。版本常量设置为 7.4.3-local，DEBUG 设置为 false。这里的 local 字样只是构建常量，不是完整的源码版本证明；定位某次修改仍应记录 Git 提交。

主入口还会 import 引擎子包。配置扫描 packages/pixijs-source/packages，只对存在 src/index.ts 的目录生成别名：

```ts
readdirSync(localPixiPackagesRoot)
  .filter(name => existsSync(resolve(localPixiPackagesRoot, name, 'src/index.ts')))
  .map(name => ({
    find: `@pixi/${name}`,
    replacement: resolve(localPixiPackagesRoot, name, 'src/index.ts'),
  }))
```

按本次快照统计，共生成 53 项。这是目录扫描结果，不是通过浏览器网络请求测得的模块数量。

## 为什么混用两份引擎不只是包体积问题

假设核心类分别来自本地模块 A 和安装模块 B，即使源代码文本相同，类构造器也有不同身份：

```js
const A = class Texture {}
const B = class Texture {}
const value = new A()
console.log(value instanceof B) // false
```

注册表、单例缓存也可能各有一份。于是“我修改的注册代码执行了”与“实际渲染读取的是这份注册表”并不等价。这里是 JavaScript 模块身份的示意，不是在宣称项目已经存在两份 Texture。

排查时应沿入口继续看内部 import 的 resolved id，而不是只在配置里搜索 pixi.js。当前配置同时将本地子包排除出 optimizeDeps，意图让这些源码保持一致的解析方式；但是否完全覆盖深层导入，仍需从真实使用模块验证。

## GLSL 需要变成合法 JavaScript 模块

引擎会导入 .frag、.vert。当前插件在 pre 阶段执行：

```ts
load(id) {
  const filePath = id.split('?')[0]
  if (!filePath || !/\.(frag|vert)$/.test(filePath)) return null
  return `export default ${JSON.stringify(readFileSync(filePath, 'utf8'))}`
}
```

它先剥离查询参数，再读文件，输出默认导出的字符串。这里 JSON.stringify 不是装饰：Shader 中含换行、引号和反斜杠，必须转义成合法的 JS 字符串。

如果直接把文本拼进双引号，下面的源码就能破坏生成模块：

```glsl
// a "quoted" label
void main() {
    gl_FragColor = vec4(1.0);
}
```

该插件做的是资源格式适配，不负责验证 GLSL 是否可在目标 GPU 编译。Vite 构建通过，仍不能替代浏览器端着色器编译与渲染检查。

此外插件按扩展名匹配所有被加载文件，并没有限制到本地 Pixi 根目录。如果应用其他部分也有 GLSL，是否希望采用同样转换规则，应写成明确约束。

## Worker 前缀是另一套模块协议

源码中存在 worker: 前缀导入。Vite 插件处理为：

```ts
if (!source.startsWith('worker:') || !importer) return null
const resolved = await this.resolve(source.slice('worker:'.length), importer, {
  skipSelf: true,
})
if (!resolved) return null
return `${resolved.id}?worker`
```

为什么不能直接 source.replace？因为相对路径的基准是 importer，不是应用根目录。先调用 this.resolve 才能沿正常解析规则得到目标；skipSelf 防止再次进入当前前缀处理。最后的 ?worker 交给 Vite 后续 Worker 机制。

需要专门覆盖目标已带查询参数的情况，不能默认 resolved.id 永远是裸路径；这种输入应有固定样例，确认拼接结果不会变成两个问号。本文没有在源码中确认此类导入实际出现，所以把它列为转换契约的边界，不写成既有故障。

## 缺源码时，warn 不等于可继续运行

配置先检测本地 packages 目录，不存在时打印警告，随后仍调用 getLocalPixiPackageAliases，而该函数直接 readdirSync。缺失目录时扫描会抛错，不能因为日志使用 warn 就以为会自动回退 npm 版本。

这对新机器和 CI 很实际：是否需要获取完整引擎源码，应在准备步骤就确定。若支持回退，必须将别名、Shader、Worker、预构建配置整体切到同一模式；只给主入口加回退会重新制造混合图。

当前最清晰的契约是要求源码存在，并在检查阶段给出明确错误。本文未修改配置，只指出实际控制流。

## 用四层证据确认接入

建议按下列顺序验证一次引擎改动：

1. 确认应用入口的 resolved id 指向指定 checkout。
2. 选择一个真实使用的 @pixi 子包，确认没有绕到安装目录。
3. 找一个实际 Shader 导入，检查构建输出是正确转义的文本。
4. 找一个真实 Worker 功能，检查资源路径在部署子目录下仍成立，再观察功能结果。

还要分开测试应用和包消费者：pixichart 清单用 file 依赖指向本地 bundle，但应用 Vite 可以绕过该清单去读 src；React 包的独立构建和 Storybook 也有自己的入口。应用中能断点，不代表发布包包含了同一份修改。

这次结论基于配置、依赖清单和 53 个别名的静态统计，没有启动完整建模应用或测量帧率。源码为 `client/vite.config.ts` 及 `packages/pixichart/package.json`、`packages/reactPixichart/package.json`，提交 `67b9805a06`。理解这条解析链，才能把“本地引擎生效”变成可核对的事实。
