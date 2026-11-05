# MBSE Flow研发笔记 · 2026-11-05

## 写作定位与本次范围

博客已有项目介绍和整体方案，本批从真实研发中的具体问题展开，不重复介绍整套架构。新增四篇完整文章，均为`status: draft`，只在本地开发预览可见；未授权正式发布，因此不修改已有文章状态、不提交推送或触发部署。

| 建议顺序 | 文章文件 | 角度与与旧文的区别 |
| --- | --- | --- |
| 1 | [mbse-flow-demo-to-product](../src/content/notes/mbse-flow-demo-to-product.md) | 从三项功率研究示例到用户任务，讨论CSV入口、工况/参数角色和产品验收 |
| 2 | [mbse-flow-canvas-semantic-command](../src/content/notes/mbse-flow-canvas-semantic-command.md) | 跟随一次拖入动作，解释语义/布局/草稿/提交的分工，不重复全局方案 |
| 3 | [mbse-flow-requirement-quality-agent](../src/content/notes/mbse-flow-requirement-quality-agent.md) | 需求质量技能与单事件自动检查，区别旧SE-MBSE的AgentScope宿主运行文章 |
| 4 | [mbse-flow-multi-agent-delivery](../src/content/notes/mbse-flow-multi-agent-delivery.md) | 多AI共享工作区、依赖/契约和代码/证据修订，区别通用团队管理文章 |

## 已核对的事实边界

- 内容基准为mbse-flow已提交修订`d17f2920261c0fffb285081df9b94e471d054ce7`；博客写作起点`b0acb96`。不把另一执行者的未提交T075改动纳入已完成事实。
- 任务板记录T067～T074、T083/T084/T085为作者`verified_solo`，不等于非作者复核或完整产品交付。T075在研发，T076～T081等完整流程尚未完成。
- 阅读了已提交的T074/T083/T084/T085交接及对应有限实现/规划。技能与自动化已出现作者验收增量；不能沿用前一日“尚未开始”的旧结论。
- T085记录历史验收的补充和元数据核验，明确不是独立产品复跑。旧证据不在原被测修订的问题是真实观察，不能被改写为编造测试、产品运行失败或独立验收通过。
- 60−35−10=15、42−35−10=−3来自早期构造静态预算；双工况15/8、变化3/−4、修正17/10来自规划案例的独立预期。本文没有重新执行产品、仿真、硬件试验或客户采用验证。
- 首个AI闭环仅一个需求质量技能与一个内部需求提交事件；作者可见构造评测不代表盲测或客户准确率。无CAD/Git全工具覆盖、自动批准或工业级吞吐结论。

## 对外写作约束

文章不包含内部任务号、真实提交SHA、绝对工作区路径、内部服务地址、项目UUID、用户账号、密钥或原始请求内容。正文命令/对象标识/需求文字均清楚标为示意；不复制供应商材料或手册全文。产品选择、标准参照、当前实现与未来目标分别表达。

作者语气沿用博客：从具体问题进入，用架构解释取舍，保留限制，不写成产品宣传或任务汇报。文章不会把AI开发者数量转化为效率/工期承诺。

## 标准与命令参考核验

2026-11-05只核对公共参考页面，不更新mbse-flow的固定标准字节：

- [OMG SysML 2.0](https://www.omg.org/spec/SysML/2.0)
- [OMG KerML 1.0](https://www.omg.org/spec/KerML/1.0)
- [Git show](https://git-scm.com/docs/git-show)
- [Git cat-file](https://git-scm.com/docs/git-cat-file)

标准链接用于解释语言参照，产品统一命令、草稿、版本与审批策略是本项目架构选择。Git文档用于核对提交对象读取方式，不据此证明产品已通过测试。

## 验证记录

2026-11-05完成，均为博客检查，不作为mbse-flow产品测试或标准符合性证据：

| 检查 | 实际结果 |
| --- | --- |
| `pnpm check` | 退出0，26个Astro文件，无类型诊断错误，内容Schema检查通过；并行开发预览的同文件热更新出现ID提示，已另行确认文章slug唯一及页面内容正确 |
| `pnpm build` | 退出0；使用正式站点URL与`BASE_PATH=/hanfei-blog`本地构建，35个页面，Pagefind索引31个公开页面 |
| `pnpm verify` | 退出0；125个产物文件，关键产物、草稿隔离与子路径检查通过 |
| 四篇草稿的开发路由 | 均HTTP 200，标题正确、有草稿标识、目录与带base的链接可渲染 |
| 新草稿生产隔离补充检查 | 四篇均无生产文章页面；扫描56个HTML/XML/JS/JSON等文本产物，未出现四个新slug |
| 新增正文静态检查 | 站内文章链接存在、JSON示例可解析，无内部任务号、真实SHA、工作区路径、私有地址或密钥模式 |
| 交叉编辑审阅 | 修正产品篇的未复跑边界、交互文案示意与时态；AI篇的评测门禁例子明确为条件说明 |

本轮约1万中文正文，四篇均是完整文章。没有更改任何发布状态、推送或部署。

当前本地开发预览在`http://127.0.0.1:4331/hanfei-blog`；草稿需直接进入下列路由，公开列表会继续过滤草稿：

- [产品体验篇](http://127.0.0.1:4331/hanfei-blog/notes/mbse-flow-demo-to-product/)
- [图形与语义篇](http://127.0.0.1:4331/hanfei-blog/notes/mbse-flow-canvas-semantic-command/)
- [需求质量AI篇](http://127.0.0.1:4331/hanfei-blog/notes/mbse-flow-requirement-quality-agent/)
- [多AI交付篇](http://127.0.0.1:4331/hanfei-blog/notes/mbse-flow-multi-agent-delivery/)

正式发布沿用[写作指南](writing-guide.md)：选择本篇发布日期，填写publishedAt并调整status，按原有部署流程执行。这里不批量修改旧文章或调整网站功能。
