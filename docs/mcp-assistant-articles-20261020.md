# MCP 与内置建模助手文章交付记录

## 固定来源

- 仓库：`D:\workspace\shareetech\SE-MBSE`
- 指定分支：`feature/v2.5.0/normal`
- 固定提交：`4918e0d27813a06f7496bd387758e7f3d474ed20`
- 提取日期：2026-10-20
- 方式：从 Git 对象提取目标文件到博客 `.astro/source-20261020`，没有切换 SE-MBSE 当前分支，没有改动其工作区。
- 分支内容和本地当前检出的旧版实现不同。文章只以该固定提交为依据，助手入口为 `client/src/appModeling/components/aiAssistant/`。

## 新增三篇

| 文件 | 核心问题 |
| --- | --- |
| `src/content/notes/mcp-domain-tool-boundaries.md` | 工具契约怎样表达领域语义，并复用权限和正式业务服务 |
| `src/content/notes/mcp-write-receipts-and-recovery.md` | 如何区分未提交、已应用但有警告、结果未知，避免重复写入 |
| `src/content/notes/modeling-assistant-runtime.md` | 如何持久化会话、待确认命令、未决写入与长任务上下文 |

按仓库写作指南均保存为 `draft`。本地 `pnpm dev` 可以访问；生产构建不生成文章页面。未提交、推送或部署。

## 编辑取舍

- 使用真实类名、实际状态和故障窗口，避免泛泛介绍 MCP / Agent。
- 示例代码明确区分源码摘录和执行结构示意。
- 不把历史文档中的通过数量冒充本次测试。
- 不把进程内工程协调说成分布式锁。
- 不把批次说成原子事务，不把停止说成撤销。
- LIVE 前置条件不冒称历史快照验证。
- 子任务默认只读角色与硬权限边界分别描述。
- 不宣称通用复制、通用撤销或分布式 exactly-once 已实现。
- 不引用内部服务地址、凭证、用户数据或实际工程模型内容。

## 源码证据

详见同目录 `mcp-assistant-sources-20261020.json`。每个条目包含原仓库路径、SHA-256 及关键符号所在行，行号仅对应固定提交。

补充记录：

- `server/docs/features/mcp-tools-audit-20261016.md` 用于说明表达式、属性类型/单位、运行时自动化候选的本轮调整；有关测试结果只属于历史记录。
- MCP 工具协议引用官方 `2025-06-18/server/tools`，只用于工具发现/调用、Schema 和 `isError` 的基本定义，不作为项目权限或事务实现的证据。

## 可复现实验

目录：`public/examples/mcp-assistant-20261020/`

运行：

```sh
node public/examples/mcp-assistant-20261020/verify.mjs
```

原样提取四个独立源文件并记录 SHA-256。TypeScript 只进行类型擦除，Java 回执类直接编译。12 项外层检查通过，其中 Java 回执实验包含 8 个断言。

范围：流分帧和终态、取消、错误处理、ID 精度、回执错误分类和压缩字段。

没有运行完整 SE-MBSE 后端测试，没有连接真实模型服务、数据库或进行多实例故障注入。

## 站点验证

- `pnpm check`：26 个 Astro 文件，0 errors / 0 warnings / 0 hints。
- `pnpm build`：构建成功，生产生成 23 个页面，Pagefind 收录 19 篇已发布文章。
- `pnpm verify`：通过，包含草稿隔离与 base 前缀检查。
- 本地未配置 `SITE_URL`，构建使用占位域名；本次只做本地验证，未发布。
- 首次构建在内容同步阶段出现一条新增文章 ID 覆盖警告；核对源文件只有一个对应 slug，三个新路由在开发模式均正确，生产草稿隔离通过。
- Chrome 无头模式检查三篇文章分别在 390px / 1440px 下的六个页面：HTTP 200、草稿提示存在、无整页横向溢出、图片加载正常、正文站内链接返回正常、无页面脚本异常。
- 已查看桌面执行链图和手机表格截图。长标识可换行，表格没有撑宽页面；SVG 可点击打开大图。
- 截图与结构检查结果位于 `.astro/mcp-assistant-render-qa.json` 和同目录截图中，不进入版本控制。

文章排版沿用既有模板，新增两张可缩放 SVG 执行链图，未修改站点布局或业务组件。
