# 工程文章配套实验

对应 2026-09-16 重写的 14 篇 SE-MBSE 工程文章。输入使用虚构标识，不连接应用、数据库、许可服务或外部网络。实验保留当前实现的边界行为，不是修复版本。

可下载完整目录的压缩包：[engineering-labs.zip](../engineering-labs.zip)。解压后进入含 `verify.mjs` 的目录。不能只下载入口脚本，脚本还需要 `fixtures/`。

## 运行 JavaScript 实验

需要 Node.js 20 或更高版本；本轮使用 Node.js 22.14.0。无须安装 npm 依赖。

```sh
node verify.mjs
```

成功时有 16 条场景输出及 PASS；实际结果保存在 `expected-output.txt`。其中 `min=0 hits VM timeout` 是预期断言：VM 在 100 毫秒时中止原函数的不终止循环，整个实验正常结束。

### 验证层级

| 场景 | 执行对象 | 替身与范围 |
| --- | --- | --- |
| 请求合并、失败重试、刷新乱序、参数切换 | 原 createAtomFetcher 编译快照 | 内存 Jotai、最小 Hook 调度；无真实 React 渲染 |
| 底层重连和超时参数 | 原 Websocket 编译快照 | 假原生连接与可手动触发的定时器，无网络 |
| 上层重连未创建新实例 | 原 wsStore 编译快照 | 替换环境 URL、token 获取与连接依赖 |
| 许可旧响应覆盖新状态 | 原 guard.tsx 中 Hook 编译快照 | 可控 Promise 与 Hook 生命周期替身 |
| barrel 默认导入与快速过滤 | 原插件包装器 | 第三方 transform 只记录输入，未验证第三方最终转换 |
| 内部包映射遗漏 | 原 ResolverBuilder 编译快照 | 真实转换逻辑，虚构路径和导出映射 |
| Size 注解循环 | 原生成器抽取函数 | 隔离 VM；没有执行清理目录及生成任务链 |
| 分页漂移、嵌套异步、集合清理、大整数解析 | 4 个独立模型实验 | 不执行相应 Java 服务；只验证文章中的构造反例 |

Hook 替身只支持本次用到的状态槽、依赖变化与清理，不模拟并发渲染、StrictMode、真实组件调度和浏览器事件循环。定时器由测试显式触发，不代表真实网络计时测试。

## 运行原始 Java 工具类实验

需要 JDK 21；本轮使用 Microsoft OpenJDK 21.0.7。

```sh
javac -encoding UTF-8 -d out java/LogSanitizer.java java/LogSanitizerLab.java
java -cp out LogSanitizerLab
```

共 10 项断言，使用未经修改的 `LogSanitizer` 类，覆盖 URL 正常与降级分支、掩码、指纹、UTF-16 长度与 UTF-8 字节长度、控制字符范围。结果见 `expected-java-output.txt`。所有 URL 和凭据样式字符串均为 `example.test` 合成数据。

## 来源与可追溯性

- 源仓库 HEAD：`67b9805a064b68dffda405e2f1134e57b84859e1`。
- `fixtures/manifest.json` 记录源文件路径、源文件 SHA-256、编译器版本和每个 JS 快照的 SHA-256。
- TypeScript 快照移除类型与注释，输出 ES2022 / CommonJS；项目依赖由测试显式提供。遇到未声明依赖时立即报错。
- 唯一环境表达式替换是 wsStore 中的 `import.meta.env.VITE_APP_BASE_URL`，置为空字符串以便 VM 执行；清单已标记。
- `required.cjs` 只抽取两个正则常量与目标函数，避免原生成器顶层文件操作。
- Java 工具类直接复制，保留原 package；没有复制项目配置、真实请求载荷或访问凭据。

实验结果说明特定输入与交错下的行为。它们不替代 SE-MBSE 的真实 React、网络、Spring、Ignite、数据库、文件服务或 OSLC 集成测试，也不证明候选改造已投入使用。
