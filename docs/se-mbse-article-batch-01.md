# SE-MBSE 工程文章 · 第一辑

作者定位：韩飞，SE-MBSE 项目负责人，关注技术方案、架构设计与团队交付。

截至 2026-09-16，本辑 15 篇均已完成深度重写：此前完成版本缓存篇，本轮完成其余 14 篇。各篇围绕具体调用链、失败条件和验证方法展开。保留现有 published 状态与发布日期，本次修改仍在本地，未推送或部署。

## 文章目录

| 顺序 | 文章 | 验证依据 |
| --- | --- | --- |
| 1 | [把字典服务拆出去之前：沿一次缓存失效检查模块边界](../src/content/notes/modular-monolith-api-service.md) | 静态调用链；未执行跨进程拆分 |
| 2 | [拆成五个包以后，边界真的成立了吗：追踪建模前端的三种依赖图](../src/content/notes/pnpm-workspace-boundaries.md) | 包清单与解析配置静态核对 |
| 3 | [接入本地 PixiJS 不能只改一个 alias：入口、子包、Shader 与 Worker](../src/content/notes/local-pixijs-source-integration.md) | 静态解析链；未跑应用图形渲染 |
| 4 | [一次 import 优化会丢掉什么：从默认导入到不完整导出映射](../src/content/notes/barrel-import-optimization.md) | 执行源码快照；第三方 transform 使用记录输入的替身 |
| 5 | [同一个请求只发一次之后：共享 Promise、刷新竞态与参数切换](../src/content/notes/atom-request-coalescing.md) | 执行源码快照；Jotai/React 调度替身 |
| 6 | [重连定时器执行了，连接为什么没恢复：拆开 WebSocket 的两层生命周期](../src/content/notes/websocket-reconnect-state-machine.md) | 执行上下两层源码快照；连接、时钟与外部依赖替身 |
| 7 | [页面切走了，许可申请才成功：把浮动许可当成异步资源管理](../src/content/notes/floating-license-lifecycle.md) | 执行 Hook 源码快照；未调用许可服务 |
| 8 | [模型改名后为什么还会读到旧值：追踪版本缓存与失效竞态](../src/content/notes/version-aware-cache-keys.md) | 完整缓存读写链与 4 个 Guava 实验 |
| 9 | [缓存事务提交以后，数据库写完了吗：追踪 Ignite 写后与分支装载](../src/content/notes/ignite-write-behind-boundaries.md) | 静态核对及容量推演；无集群、数据库测试 |
| 10 | [Future 完成了，监听器却还没结束：版本事件的完成语义](../src/content/notes/change-events-completion-semantics.md) | 静态调用链 + 独立嵌套任务模型 |
| 11 | [ConcurrentHashMap 也会丢会话：检查、移除与用户离线的三个边界](../src/content/notes/collaboration-session-cleanup.md) | 静态调用链 + 独立集合交错模型 |
| 12 | [导出显示成功，文件却没准备好：分页、管道上传与任务终态](../src/content/notes/async-excel-task-lifecycle.md) | 静态调用链 + 独立分页模型 |
| 13 | [日志脱敏函数也需要反例：非法 URL、短指纹与字符串长度](../src/content/notes/logging-useful-without-payloads.md) | 原始 Java 类编译运行，10 项断言 |
| 14 | [RDF 解析成功，不代表选对了资源：从三元组走到业务 DTO](../src/content/notes/oslc-rdf-parsing-boundaries.md) | 静态解析链与图推演；未跑 Jena 或外部 OSLC |
| 15 | [生成器遇到 @Size(min=0) 为什么卡住：类型映射背后的契约](../src/content/notes/java-typescript-contract-generation.md) | 原函数 AST 抽取后执行；独立数字解析模型；未执行完整生成器 |

## 建议先读

- 请求合并篇：有受控 Promise 复现，能看到“共享请求”与“刷新安全”的区别。
- Excel 篇：完整追到分页、管道上传、文件地址和持久化终态。
- Java → TypeScript 篇：原函数复现 Size(min=0) 卡住，再解释必填与协议精度。
- 版本缓存篇：本辑已有的缓存深度案例。

## 本地阅读

```powershell
pnpm dev --host 127.0.0.1 --port 4330
```

访问 [工程笔记](http://127.0.0.1:4330/notes/)，从文章列表进入。所有本辑文章保持 published，会进入本地生产构建；原博客的 4 篇发布样例和 1 篇草稿样例没有改动。

## 实验与依据

- [本轮 14 篇核验记录](se-mbse-deep-rewrite-02.md)：逐篇验证范围与源码入口。
- [本轮源码指纹](se-mbse-deep-sources-02.json)：源码 HEAD 与实际文件 SHA-256。
- [可运行工程实验](../public/examples/engineering-labs/README.md)：源码隔离、独立模型和 Java 工具类实验。
- [版本缓存核验记录](version-cache-deep-review.md)与[Guava 实验](../public/examples/version-cache/README.md)。
- [首版源码清单](se-mbse-article-sources-01.md)保留作历史依据；本轮新增结论以新的核验记录为准。

## 写作约束

文章区分当前实现、已执行实验、静态推演和改造建议。没有编造线上事故、性能提升、团队规模或个人贡献。示例输入为虚构数据；没有写入真实访问凭据和内部服务地址。

发布流程沿用[写作指南](writing-guide.md)。本地 check/build/verify 只能说明站点产物与内容格式符合检查，不能替代 SE-MBSE 的集成测试。正式部署时仍使用项目既有 SITE_URL 配置。
