# SysML v2 官方标准解读：第一组

## 范围与写法

新增四篇博客草稿，采用原创冷却单元示例，区分标准定义、逻辑推演和平台设计建议。没有将标准能力描述为 SE-MBSE 已实现或已通过符合性测试。

1. `sysml-v2-reading-the-standard`：文档体系、阅读路线、语义与图形、不同层次的正确性。
2. `sysml-v2-definition-usage-specialization`：分类、上下文角色、取值、typing / subsetting / redefinition。
3. `sysml-v2-requirements-verification`：assume / require、满足断言、验证计划、证据与结果。
4. `sysml-v2-api-versioned-models`：稳定身份、提交读取、缓存、分支与适配边界。

全部 `status: draft`，不更改既有文章状态、发布日期或排序。未提交、推送或部署。

## 核对基线

检索日期：2026-10-20。

| 资料 | 版本 / 文档号 | 官方入口 |
| --- | --- | --- |
| SysML Part 1 Language | 2.0 / formal/2026-03-02 | https://www.omg.org/spec/SysML/2.0/Language/PDF |
| KerML | 1.0 / formal/2026-03-01 | https://www.omg.org/spec/KerML/1.0/PDF |
| Systems Modeling API and Services | 1.0 / formal/2026-03-04 | https://www.omg.org/spec/SystemsModelingAPI/1.0/PDF |
| REST/OpenAPI | ptc/25-02-30 | https://www.omg.org/spec/SystemsModelingAPI/20250201/OpenAPI.json |
| 数量与单位模型库 | ptc/25-04-29 | https://www.omg.org/spec/SysML/20250201/Quantities-and-Units-Domain-Library.kpar |

当前官方目录的文档修订为 2026 年 3 月，不能混用 Beta 文档；语言版本仍为 2.0。文章中的 `#page=` 是 PDF 文件页码，正文印刷页码不同。

下载文件仅保存在忽略目录 `.astro/sysml-standards-20261020/` 供本地核对；不将官方全文加入博客。公开的 `source-manifest.json` 只保存 URL、文档号和 SHA-256。

## 条款与解释边界

| 文章 | 核对位置 | 自行推演的部分 |
| --- | --- | --- |
| 阅读路线 | SysML 第 7、8、9 章；三个官方目录 | 分层阅读方法、数据库与图形架构建议 |
| Definition / Usage | SysML §7.6.1、§7.6.3；KerML §7.3.3、§7.3.4.3—§7.3.4.5 | 双泵模型、集合反例、界面检查点 |
| 需求与验证 | SysML §7.21.2、§7.21.4、§7.24.1—§7.24.2 | 负阈值反例、测量区间判据、证据工作流 |
| 标准 API | API §7.1.2、第 2 章；OpenAPI 路径定义 | 缓存维度、固定提交读取、MCP 适配建议 |

数量与单位库实际核对：

- `ISQSpaceTime.sysml`：存在 `TimeValue`，是 `DurationValue` 的别名。
- `SI.sysml`：存在短名 `<s>` 的 `second`。
- `ISQ.sysml`：公开导入相关数量包。

正文使用短的标准规则说明与条款链接，其余为原创案例和分析，没有大段翻译或复制标准示例。

## 示例验证

配套目录：`public/examples/sysml-v2-standards/`。

- 三个 `.sysml` 文件：人工对照声明形式、命名与库引用核对；没有运行独立 SysML 编译器。
- 需求文件中的 verification 是计划骨架，没有实现测量动作或 verdict 计算。
- `run-experiments.mjs`：Node 无第三方依赖，8 项逻辑及架构推演通过。
- JavaScript 推演不是 SysML 求值器，不构成语言符合性证明。
- 没有运行 SE-MBSE 后端、标准 API 服务或真实试验。

## 网站验证

按实际 GitHub Pages 的 `SITE_URL=https://cdfeih.github.io/hanfei-blog`、`BASE_PATH=/hanfei-blog` 和 `STRICT_SITE=1` 检查，避免只验证本地根路径。

- `pnpm check`：26 个 Astro 文件，0 errors / 0 warnings / 0 hints。
- `pnpm build` 与 `pnpm verify`：成功，严格子路径检查通过。
- 四篇分别在 390px 与 1440px 下检查，共八个页面：HTTP 200、草稿提示存在、无整页横向溢出、无页面脚本异常。
- 开发预览同样使用 `/hanfei-blog` 前缀，正文站内链接均带此前缀且返回成功。
- 四篇草稿没有生成生产文章路由，未进入 RSS。
- 已查看手机真值表和桌面代码块截图，排版正常。
- 结构检查结果和截图位于 `.astro/sysml-standards-qa.json` 等忽略文件中。
- 内容同步曾提示旧 MCP 文章 ID 覆盖；本次未编辑旧文章，后续构建正常，四篇新文章各自只有一个 slug。
