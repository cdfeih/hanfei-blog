# 第一辑文章源码依据

> 首版历史清单。2026-09-16 的 14 篇重写新增调用链与实验，见[本轮核验记录](se-mbse-deep-rewrite-02.md)和[完整源码指纹](se-mbse-deep-sources-02.json)。

核对日期：2026-09-15。源码根目录：`D:/workspace/shareetech/SE-MBSE`。HEAD：`67b9805a064b68dffda405e2f1134e57b84859e1`。

此文件用于作者维护与复核，不进入博客页面。以下路径相对于源码根目录；SHA-256 对应实际阅读工作区文件，便于识别后续变动。HEAD 只标识仓库版本，不代替工作区文件校验。代码的存在不等于运行结果已通过验证。

## 多模块不等于微服务：建模平台的 API、实现与启动边界

[文章](../src/content/notes/modular-monolith-api-service.md)

核对内容：契约、实现与组合启动分层；injvm 为当前配置，不能据此推断所有环境。

- `server/pom.xml`
  - SHA-256：`89cbcf98662c251a35869be54b5cd85fa5ead877523e78cbf7b5a4baa7de4bc4`

- `server/mbse-platform-web/pom.xml`
  - SHA-256：`f26a2b42340a0104a5da0c2314e149582bef147dd6e88c33c52b3a349c3358a2`

- `server/mbse-platform-project/mbse-platform-project-service/pom.xml`
  - SHA-256：`6db69a3ab97e1e9da36a3e4aaa67625988bf7bfcd75a59d5134bb2e44ed4df86`

- `server/mbse-platform-web/src/main/resources/application.properties`
  - SHA-256：`7a2eb40b597086bea32544f4c87cda190d8005d0ed2645eb816239f8a8f012fe`

- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/dubbo/DubboConfig.java`
  - SHA-256：`56e1f739ddbc3549e01de58339da3097709535bb8b20beaa9e5756b08c5aaed3`

## 大型前端为什么要拆包：从建模平台的工作区边界谈起

[文章](../src/content/notes/pnpm-workspace-boundaries.md)

核对内容：工作区范围、包依赖与应用源码别名。

- `client/pnpm-workspace.yaml`
  - SHA-256：`38b887ad12b22f5b6fb356933a78f81686b242d8819c7efff6a3c5f2f4929162`

- `client/packages/pixichart/package.json`
  - SHA-256：`cc8b8925b8f1c19d055039d3ba4d2c7291d9ffe233f089280352d7dfd932892d`

- `client/packages/reactPixichart/package.json`
  - SHA-256：`0259a06f4c9e9de57909b363d77f839a6969d6fb514e1ff4525d28a51fcaf0d8`

- `client/vite.config.ts`
  - SHA-256：`71224c44e2a0c1aac5db0a83c3d8dec4e60807a0a57a54d1223468acf2af32c5`

## 定制 PixiJS 如何接入应用：真正要统一的是整条解析链路

[文章](../src/content/notes/local-pixijs-source-integration.md)

核对内容：当前固定 source 模式，含 @pixi 子包、Shader、Worker 处理。

- `client/vite.config.ts`
  - SHA-256：`71224c44e2a0c1aac5db0a83c3d8dec4e60807a0a57a54d1223468acf2af32c5`

## 优化 barrel 导入之前，先守住模块语义

[文章](../src/content/notes/barrel-import-optimization.md)

核对内容：quickCheck、默认与具名混合导入、开发开关与测试模式。

- `client/plugins/vite-barrel-resolution.ts`
  - SHA-256：`555f882437d1c6155e4df82aab402e656f3829131e381bfe584134874794dca9`

- `client/vite.config.ts`
  - SHA-256：`71224c44e2a0c1aac5db0a83c3d8dec4e60807a0a57a54d1223468acf2af32c5`

## 三个组件请求同一份数据：用共享 Promise 合并在途请求

[文章](../src/content/notes/atom-request-coalescing.md)

核对内容：共享 atom、在途 Promise、强制刷新与 effect 依赖；竞争问题为静态分析。

- `client/src/common/hooks/createAtomFetcher.ts`
  - SHA-256：`b7b807c2472f97f7e7da7a0811abb7f251e72a0a642977ed5d97b658b94eeee3`

## WebSocket 重连为什么不能只写一个定时器

[文章](../src/content/notes/websocket-reconnect-state-machine.md)

核对内容：init、beforeSend、重试与关闭状态；未深入底层连接封装，不能推断实际重连结果。

- `client/src/stores/wsStore.ts`
  - SHA-256：`9fa3e5e7341a2d68360290a6a685f275d84df7eafd5613a6848c189602a63f64`

## 浮动许可如何跟随页面生命周期：申请、占用与归还

[文章](../src/content/notes/floating-license-lifecycle.md)

核对内容：LicenseGuard、useModelingLicense 的申请与清理；不代表服务端授权全链路。

- `client/src/routes/guard.tsx`
  - SHA-256：`89a835d194755750bba7d4617b65a624e2b96d8fc738e176b608780ebcb8a0f8`

- `client/src/stores/wsStore.ts`
  - SHA-256：`9fa3e5e7341a2d68360290a6a685f275d84df7eafd5613a6848c189602a63f64`

## 同一个元素为什么会读错缓存：把工程、分支和版本放进身份

[文章](../src/content/notes/version-aware-cache-keys.md)

核对内容：键的上下文身份、导入工程、Optional、复制与失效入口；未核对所有调用者。

- `server/mbse-platform-project/mbse-platform-project-service/src/main/java/com/shareetech/mbse/platform/project/metamodel/cache/manager/AbstractVersionedCacheManager.java`
  - SHA-256：`6e86910ae7691cc8caf4be73bc053591aaacc4efea4aab75d3e402a989590897`

- `server/mbse-platform-project/mbse-platform-project-service/src/main/java/com/shareetech/mbse/platform/project/metamodel/cache/manager/ElementCacheManager.java`
  - SHA-256：`bbe036bc9e2761f8dba416c9276cf3fe33f7fa32f71fd52d060e7f9aa3a3339e`

## 缓存写成功以后，数据库一定更新了吗？理解 Ignite 写后落库

[文章](../src/content/notes/ignite-write-behind-boundaries.md)

核对内容：writeBehind 配置、分支加载双重检查、事务挂起恢复与清理待办。

- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/ignite/IgniteCacheManager.java`
  - SHA-256：`61fa44ec175c5a75964b2ab4394aaf9d9c1bbb99de3740bde5a7d66ef894f5f6`

## 发出了变更事件，不代表所有工作已经完成

[文章](../src/content/notes/change-events-completion-semantics.md)

核对内容：同步/异步监听、继承匹配、异常捕获、外层 Future 与内层任务。

- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/ignite/event/VersionTableChangeEventPublisher.java`
  - SHA-256：`e3e2433eea8934454d0c939456556a9c9c97068f8c1b368690b0a2fb5ed63144`

## 一个浏览器断开，不代表一个用户离线：协同会话的资源清理

[文章](../src/content/notes/collaboration-session-cleanup.md)

核对内容：clearSession、hasActiveSessionInProject、cleanupExpiredSessions；两种清理覆盖不同。

- `server/mbse-platform-project/mbse-platform-project-service/src/main/java/com/shareetech/mbse/platform/project/websocket/CollaborativeSessionManager.java`
  - SHA-256：`a95ebc84dd9d267271fa18b73e2441d692262c55de5e13a580b1b5670ca87474`

## Excel 导入导出异步化之后，真正需要管理的是任务生命周期

[文章](../src/content/notes/async-excel-task-lifecycle.md)

核对内容：Handler、Support、Context、分页处理与回调；持久任务、恢复和取消是建议。

- `server/mbse-platform-sys/mbse-platform-sys-service/src/main/java/com/shareetech/mbse/platform/asyncexcel/importer/AsyncExcelImporter.java`
  - SHA-256：`b0b8d47aef8d35c517b5e2fa0d7687310d188aaf2621eeb0b9dbf0417e1c50a0`

- `server/mbse-platform-sys/mbse-platform-sys-service/src/main/java/com/shareetech/mbse/platform/asyncexcel/exporter/AsyncExcelExporter.java`
  - SHA-256：`225acc036e225e80cde9c8f9e2e31ed0997489bdac88d1af84461d3e1e4783eb`

## 排障日志需要多少数据：用端点、长度和指纹替代整包输出

[文章](../src/content/notes/logging-useful-without-payloads.md)

核对内容：mask、withoutQuery、fingerprint、payloadSummary 的具体语义与边界。

- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/util/LogSanitizer.java`
  - SHA-256：`f50361aacfff641e25ed55f4f6a0628e0f17591cfdc5d7a64256fe9736a3a1fe`

## 对接 OSLC 时，先确认拿到的是 RDF，再谈资源解析

[文章](../src/content/notes/oslc-rdf-parsing-boundaries.md)

核对内容：空输入、解析失败、空模型、URI/空白节点/字面量与首项读取。

- `server/mbse-platform-adapter/mbse-platform-adapter-service/src/main/java/com/shareetech/mbse/platform/adapter/oslc/parser/OslcRdfModelReader.java`
  - SHA-256：`b584771ceeece38e5554a957aef8e1ae32d42a607cd9d741d434266d022348d2`

## 从 Java 生成 TypeScript：自动化的难点在契约，不在文件数量

[文章](../src/content/notes/java-typescript-contract-generation.md)

核对内容：类型映射、isFieldRequired、任务顺序、--out-dir；未执行生成器。

- `client/script/convertJavaToTs.cjs`
  - SHA-256：`1d8752810a5e19734d6eb5cfe4220f9be0387274dade5e87700b6cf88861a67b`

## 公开机制参考

- [Ignite 外部存储与写后机制](https://ignite.apache.org/docs/ignite2/latest/persistence/external-storage)
- [React useEffect 生命周期](https://react.dev/reference/react/useEffect)
- [Apache Jena RDF API](https://jena.apache.org/tutorials/rdf_api.html)
- [JavaScript 安全整数范围](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER)

外部资料用于解释通用机制；项目采用了什么实现，以以上本地源码为准。

## 本次操作范围

只读取 SE-MBSE 源码并编写博客内容，没有改动原工程实现、执行代码生成器、连接业务数据库或做性能和故障演练。文章中的验证场景是建议，实际完成的检查仅针对博客内容及渲染。
