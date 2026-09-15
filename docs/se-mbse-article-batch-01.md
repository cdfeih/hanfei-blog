# SE-MBSE 工程文章 · 第一辑

作者定位：韩飞，SE-MBSE 项目负责人，关注技术方案、架构设计与团队交付。

本辑共 15 篇，写作日期为 2026-09-15。文章从当前工程实现提炼问题、设计取舍和验证方法，使用独立示例解释原理。全部保存为 `draft`，可在本地逐篇预览，生产构建不会生成这些文章。

## 文章目录与建议阅读顺序

| 顺序 | 文章 | 主要看点 |
| --- | --- | --- |
| 1 | [多模块不等于微服务：建模平台的 API、实现与启动边界](../src/content/notes/modular-monolith-api-service.md) | 模块边界与部署边界，适合作为本辑入口 |
| 2 | [大型前端为什么要拆包：从建模平台的工作区边界谈起](../src/content/notes/pnpm-workspace-boundaries.md) | 引擎、框架适配与业务应用的职责 |
| 3 | [定制 PixiJS 如何接入应用：真正要统一的是整条解析链路](../src/content/notes/local-pixijs-source-integration.md) | 入口、子包、Shader 与 Worker |
| 4 | [优化 barrel 导入之前，先守住模块语义](../src/content/notes/barrel-import-optimization.md) | 默认导入、开发构建与测试替身 |
| 5 | [三个组件请求同一份数据：用共享 Promise 合并在途请求](../src/content/notes/atom-request-coalescing.md) | 请求身份、缓存状态与刷新竞争 |
| 6 | [WebSocket 重连为什么不能只写一个定时器](../src/content/notes/websocket-reconnect-state-machine.md) | 连接状态、等待发送与业务恢复 |
| 7 | [浮动许可如何跟随页面生命周期：申请、占用与归还](../src/content/notes/floating-license-lifecycle.md) | 许可资源与界面生命周期 |
| 8 | [同一个元素为什么会读错缓存：把工程、分支和版本放进身份](../src/content/notes/version-aware-cache-keys.md) | 版本身份、跨工程引用与空结果缓存 |
| 9 | [缓存写成功以后，数据库一定更新了吗？理解 Ignite 写后落库](../src/content/notes/ignite-write-behind-boundaries.md) | 写后缓冲、读路径与清理边界 |
| 10 | [发出了变更事件，不代表所有工作已经完成](../src/content/notes/change-events-completion-semantics.md) | 监听顺序、异常隔离与 Future 范围 |
| 11 | [一个浏览器断开，不代表一个用户离线：协同会话的资源清理](../src/content/notes/collaboration-session-cleanup.md) | 多标签页、主动清理与定期清理 |
| 12 | [Excel 导入导出异步化之后，真正需要管理的是任务生命周期](../src/content/notes/async-excel-task-lifecycle.md) | 分页、进度、失败反馈与任务恢复 |
| 13 | [排障日志需要多少数据：用端点、长度和指纹替代整包输出](../src/content/notes/logging-useful-without-payloads.md) | 可诊断性与日志字段的含义 |
| 14 | [对接 OSLC 时，先确认拿到的是 RDF，再谈资源解析](../src/content/notes/oslc-rdf-parsing-boundaries.md) | 响应分类、资源身份与字面量语义 |
| 15 | [从 Java 生成 TypeScript：自动化的难点在契约，不在文件数量](../src/content/notes/java-typescript-contract-generation.md) | 类型映射、校验语义与团队同步流程 |

建议首批优先审阅第 1、5、8 篇：分别展示总体架构判断、前端实现深度和建模领域理解。后续按相关主题连续发布，方便读者形成完整认识。本表只是编辑建议，没有设置发布日期或自动发布任务。

## 本地阅读

在博客目录运行：

```powershell
pnpm dev --host 127.0.0.1 --port 4330
```

访问 `http://127.0.0.1:4330/notes/<slug>/`，其中 `<slug>` 是文章文件名去掉 `.md` 后的部分。例如：

- [架构总览](http://127.0.0.1:4330/notes/modular-monolith-api-service/)
- [请求合并](http://127.0.0.1:4330/notes/atom-request-coalescing/)
- [版本缓存](http://127.0.0.1:4330/notes/version-aware-cache-keys/)

草稿使用直接地址预览，不会自动出现在公开文章列表。页面顶部的草稿提示属于博客现有功能。

## 写作与事实边界

- 源码快照：`67b9805a064b68dffda405e2f1134e57b84859e1`。具体文件和校验值见[源码依据](se-mbse-article-sources-01.md)。源码后续变化时，应重新核对相关结论。
- 文中“当前实现”来自本次阅读到的源码；改进方向、验证场景属于分析与建议。没有把建议写成已经落地的项目成果。
- 未编造吞吐、耗时、团队规模、客户名称或事故经历；未将代码中的待办描述为已解决。
- 示例名称与数据为说明原理而重写，没有复制访问凭据、内部地址或业务数据。仍应由作者根据项目内容公开范围决定最终发布版本。
- 文章聚焦工程问题，避免使用未经确认的“我亲自设计了全部模块”等个人履历描述。个人决策背景可在后续提供真实经历后补充。
- 原博客已有的 4 篇发布状态样例和 1 篇草稿样例保持原样。本辑没有替换它们；正式整理首页时，需另行决定保留、改写或撤下哪些样例。

## 正式发布

按[现有写作指南](writing-guide.md)逐篇将 `status: draft` 改为 `published`，填写真实 `publishedAt`，再执行 `pnpm check`、`pnpm build` 和 `pnpm verify`。

如果希望首页优先展示某篇，可设置 `featuredOrder`，并与已有精选排序协调。没有封面的文章仍可使用现有正文排版，不必为发布强行补通用装饰图。

本次在本地新增文章及维护文档，并修正文章表格在手机上撑宽页面的问题，没有提交、推送或部署。当前本地构建未配置 `SITE_URL`，使用博客的占位域名完成验证；部署前需按项目部署说明配置真实站点地址。

## 内容与显示验证

- 15 篇正文合计约 1.6 万汉字，不含元数据；各篇均有完整正文和实现线索。
- 内容格式、唯一 slug、主题字段及 Astro 检查通过。
- 15 个草稿地址均返回正常页面，标题、正文标题与 Markdown 表格正常生成。
- 在 390px 手机视口逐篇检查，修正表格引起的整页溢出后，15 篇均无整页横向溢出。
- 桌面抽查长标题和正文结构；手机抽查长标题、目录与正文排版。没有改动首页设计。
- 生产构建与现有产物检查通过；另对本辑全部标题和 slug 扫描，确认没有进入生产产物。
