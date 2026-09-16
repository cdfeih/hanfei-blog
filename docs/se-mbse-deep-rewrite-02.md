# 其余 14 篇深度重写：核验记录

日期：2026-09-16。源码 HEAD：`a7672e12ced60c850f12febcd199358bc63979fa`；核验时源仓库工作区干净。本轮改动博客文章、实验资料，以及一条长行内代码的折行样式。

## 完成范围

14 篇全部重写；此前版本缓存篇保留其独立实验与核验记录。保持既有 slug、主题、文章类型、published 状态与 2026-09-15 发布日期，新增 updatedAt=2026-09-16。未提交、推送或部署。

## 逐篇证据

### 把字典服务拆出去之前：沿一次缓存失效检查模块边界

[文章](../src/content/notes/modular-monolith-api-service.md)

验证层级：静态调用链；未执行跨进程拆分。

源码文件：

- `server/pom.xml`
- `server/mbse-platform-web/pom.xml`
- `server/mbse-platform-web/src/main/resources/application.properties`
- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/dubbo/DubboConfig.java`
- `server/mbse-platform-project/mbse-platform-project-service/src/main/java/com/shareetech/mbse/platform/project/metamodel/cache/manager/DictCacheManager.java`
- `server/mbse-platform-sys/mbse-platform-sys-api/src/main/java/com/shareetech/mbse/platform/system/api/service/SysDictExternalService.java`
- `server/mbse-platform-sys/mbse-platform-sys-api/src/main/java/com/shareetech/mbse/platform/system/api/event/DictItemsChangedEvent.java`
- `server/mbse-platform-sys/mbse-platform-sys-service/src/main/java/com/shareetech/mbse/platform/system/api/SysDictExternalServiceApiImpl.java`
- `server/mbse-platform-sys/mbse-platform-sys-service/src/main/java/com/shareetech/mbse/platform/system/service/impl/SysDictServiceImpl.java`

### 拆成五个包以后，边界真的成立了吗：追踪建模前端的三种依赖图

[文章](../src/content/notes/pnpm-workspace-boundaries.md)

验证层级：包清单与解析配置静态核对。

源码文件：

- `client/pnpm-workspace.yaml`
- `client/package.json`
- `client/packages/pixichart/package.json`
- `client/packages/reactPixichart/package.json`
- `client/packages/icons/package.json`
- `client/packages/ui/package.json`
- `client/packages/utils/package.json`
- `client/vite.config.ts`
- `client/packages/resolverUtils.ts`

### 接入本地 PixiJS 不能只改一个 alias：入口、子包、Shader 与 Worker

[文章](../src/content/notes/local-pixijs-source-integration.md)

验证层级：静态解析链；未跑应用图形渲染。

源码文件：

- `client/vite.config.ts`
- `client/packages/pixijs-source/bundles/pixi.js/package.json`
- `client/packages/pixijs-source/bundles/pixi.js/src/index.ts`
- `client/packages/pixichart/package.json`
- `client/packages/reactPixichart/package.json`

### 一次 import 优化会丢掉什么：从默认导入到不完整导出映射

[文章](../src/content/notes/barrel-import-optimization.md)

验证层级：执行源码快照；第三方 transform 使用记录输入的替身。

源码文件：

- `client/plugins/vite-barrel-resolution.ts`
- `client/packages/resolverUtils.ts`
- `client/packages/pixichart/scripts/resolver.ts`
- `client/packages/reactPixichart/scripts/resolver.ts`
- `client/vite.config.ts`

### 同一个请求只发一次之后：共享 Promise、刷新竞态与参数切换

[文章](../src/content/notes/atom-request-coalescing.md)

验证层级：执行源码快照；Jotai/React 调度替身。

源码文件：

- `client/src/common/hooks/createAtomFetcher.ts`

### 重连定时器执行了，连接为什么没恢复：拆开 WebSocket 的两层生命周期

[文章](../src/content/notes/websocket-reconnect-state-machine.md)

验证层级：执行上下两层源码快照；连接、时钟与外部依赖替身。

源码文件：

- `client/src/stores/wsStore.ts`
- `client/packages/utils/src/websocket/websocket.ts`
- `client/packages/utils/src/observers/obser.ts`

### 页面切走了，许可申请才成功：把浮动许可当成异步资源管理

[文章](../src/content/notes/floating-license-lifecycle.md)

验证层级：执行 Hook 源码快照；未调用许可服务。

源码文件：

- `client/src/routes/guard.tsx`
- `client/src/stores/wsStore.ts`
- `client/packages/utils/src/websocket/websocket.ts`

### 缓存事务提交以后，数据库写完了吗：追踪 Ignite 写后与分支装载

[文章](../src/content/notes/ignite-write-behind-boundaries.md)

验证层级：静态核对及容量推演；无集群、数据库测试。

源码文件：

- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/ignite/IgniteCacheManager.java`
- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/ignite/sync/JdbcEntityStoreFactory.java`
- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/ignite/sync/JdbcEntityStore.java`
- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/ignite/sync/AbstractJdbcStore.java`
- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/ignite/metric/CacheStoreMetricsBinder.java`

### Future 完成了，监听器却还没结束：版本事件的完成语义

[文章](../src/content/notes/change-events-completion-semantics.md)

验证层级：静态调用链 + 独立嵌套任务模型。

源码文件：

- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/ignite/event/VersionTableChangeEventPublisher.java`
- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/ignite/event/VersionTableChangeMethodListener.java`
- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/ignite/event/VersionTableChangeEvent.java`
- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/ignite/event/VersionTableChange.java`
- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/ignite/event/VersionTableChangeListener.java`
- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/ignite/transaction/IgniteTransactionTemplate.java`
- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/ignite/transaction/IgniteTransactionAspect.java`
- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/config/ThreadExecutorConfig.java`
- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/config/ContextPropagatingExecutorService.java`

### ConcurrentHashMap 也会丢会话：检查、移除与用户离线的三个边界

[文章](../src/content/notes/collaboration-session-cleanup.md)

验证层级：静态调用链 + 独立集合交错模型。

源码文件：

- `server/mbse-platform-project/mbse-platform-project-service/src/main/java/com/shareetech/mbse/platform/project/websocket/CollaborativeSessionManager.java`

### 导出显示成功，文件却没准备好：分页、管道上传与任务终态

[文章](../src/content/notes/async-excel-task-lifecycle.md)

验证层级：静态调用链 + 独立分页模型。

源码文件：

- `server/mbse-platform-sys/mbse-platform-sys-service/src/main/java/com/shareetech/mbse/platform/asyncexcel/importer/AsyncExcelImporter.java`
- `server/mbse-platform-sys/mbse-platform-sys-service/src/main/java/com/shareetech/mbse/platform/asyncexcel/importer/AsyncPageReadListener.java`
- `server/mbse-platform-sys/mbse-platform-sys-service/src/main/java/com/shareetech/mbse/platform/asyncexcel/importer/AsyncImportTaskSupport.java`
- `server/mbse-platform-sys/mbse-platform-sys-service/src/main/java/com/shareetech/mbse/platform/asyncexcel/exporter/AsyncExcelExporter.java`
- `server/mbse-platform-sys/mbse-platform-sys-service/src/main/java/com/shareetech/mbse/platform/asyncexcel/exporter/AsyncExportTaskSupport.java`

### 日志脱敏函数也需要反例：非法 URL、短指纹与字符串长度

[文章](../src/content/notes/logging-useful-without-payloads.md)

验证层级：原始 Java 类编译运行，10 项断言。

源码文件：

- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/util/LogSanitizer.java`
- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/ignite/event/VersionTableChangeEventPublisher.java`

### RDF 解析成功，不代表选对了资源：从三元组走到业务 DTO

[文章](../src/content/notes/oslc-rdf-parsing-boundaries.md)

验证层级：静态解析链与图推演；未跑 Jena 或外部 OSLC。

源码文件：

- `server/mbse-platform-adapter/mbse-platform-adapter-service/src/main/java/com/shareetech/mbse/platform/adapter/oslc/parser/OslcRdfModelReader.java`
- `server/mbse-platform-adapter/mbse-platform-adapter-service/src/main/java/com/shareetech/mbse/platform/adapter/oslc/parser/OslcResourceParser.java`
- `server/mbse-platform-adapter/mbse-platform-adapter-service/src/main/java/com/shareetech/mbse/platform/adapter/oslc/parser/constants/OslcRdfProperties.java`

### 生成器遇到 @Size(min=0) 为什么卡住：类型映射背后的契约

[文章](../src/content/notes/java-typescript-contract-generation.md)

验证层级：原函数 AST 抽取后执行；独立数字解析模型；未执行完整生成器。

源码文件：

- `client/script/convertJavaToTs.cjs`

## 可追溯资料

- [源码文件 SHA-256 清单](se-mbse-deep-sources-02.json)：逐篇关联完整路径与源文件指纹。只记录配置文件指纹，不复制配置内容。
- [工程实验包说明](../public/examples/engineering-labs/README.md)：16 个 JavaScript 场景，包括 4 个独立模型；原 Java 工具类 10 项断言。
- [JavaScript 实际输出](../public/examples/engineering-labs/expected-output.txt)、[Java 实际输出](../public/examples/engineering-labs/expected-java-output.txt)。
- [此前版本缓存核验](version-cache-deep-review.md)。

## 事实与推演边界

没有把代码注释当作运行事实：重新核对了 ResolverBuilder 的 apply=serve、WebSocket 的实际条件、真实 Store 的空 delete，以及 ExcelTaskEntity 的持久化。没有把独立模型写成项目集成测试，也没有将改造建议写成已上线结果。

源码隔离实验有意保留旧响应、缺失映射和异常输入下的当前行为。没有修改 SE-MBSE 业务源码、执行生成器清理目录、访问数据库或调用许可服务。未测量生产吞吐、延迟和故障率。

## 本地发布产物验证

- pnpm check：26 个文件，0 errors / 0 warnings / 0 hints。首次内容同步出现已有缓存的 duplicate id 提示；源码 20 个 slug 唯一，后续构建无该提示，14 个改写页面均正确生成。
- pnpm build：23 个静态页面构建成功；Pagefind 索引 19 篇已发布文章。
- pnpm verify：83 个产物通过关键文件、草稿隔离与链接前缀检查。本地未设置 SITE_URL，沿用占位域名，仅用于验证，未部署。
- 14 篇保留原 slug、status、publishedAt、topics、kind；updatedAt 更新到 2026-09-16；文件为 UTF-8 无 BOM，代码围栏成对。
- 原源码/编译快照的 SHA-256 与清单一致；实验输出已保存。
- 使用本机 Chrome 无头实例验证静态产物：14 篇 × 390px / 1440px，共 28 次页面检查；标题与源码一致，正文结构正常；16 个本地链接请求成功。
- 手机检查发现长行内源码路径溢出；在 article.css 给行内 code 增加 overflow-wrap:anywhere，复验 28 个页面/视口均无整页横向溢出。代码块仍局部横向滚动。
- 抽看 Excel 篇手机与桌面截图。没有重做网站设计；未运行 SE-MBSE 完整前后端、数据库或外部服务集成测试。
- git diff --check 通过；未提交、推送或部署。
