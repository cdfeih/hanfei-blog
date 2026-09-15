# 韩飞 · 工程与架构

个人技术博客，Astro + TypeScript + Markdown 纯静态构建，部署到 GitHub Pages。

## 本地命令

```bash
pnpm install          # 安装依赖（提交了锁文件，请勿用 npm 安装）
pnpm dev              # 本地开发（含草稿预览，草稿页面会显示提示条）
pnpm check            # 类型与内容 schema 校验
pnpm build            # 生产构建（构建后自动运行 Pagefind 生成搜索索引）
pnpm preview          # 预览生产构建产物
pnpm verify           # 检查 dist：关键产物、草稿隔离、base 前缀
```

## 站点地址与子路径（base）

GitHub Pages 部署地址通过环境变量配置，本地验证时可省略：

| 变量 | 说明 | 示例 |
| --- | --- | --- |
| `SITE_URL` | 正式站点完整地址（CI 必填） | `https://<username>.github.io/hanfei-blog/` |
| `BASE_PATH` | 子路径；缺省时从 SITE_URL 推导 | `/hanfei-blog` 或 `/` |

- 未设置 `SITE_URL` 时本地构建使用占位域名 `hanfei.example.com`，**仅限本地验证，不可发布**。
- CI（GitHub Actions）构建必须提供真实 `SITE_URL`，否则构建失败（`STRICT_SITE=1` 会拦截占位域名进入部署产物）。
- 所有内部链接经由 `src/lib/urls.ts` 的 `withBase()` 生成，根路径与子路径部署均可用。

验证两种部署形态：

```bash
pnpm build && pnpm verify                                   # 默认根路径
BASE_PATH=/hanfei-blog pnpm build && BASE_PATH=/hanfei-blog pnpm verify  # 子路径
```

## 目录结构

```text
src/
  config/site.ts        # 站点信息：名称、简介、联系方式（未知留空则隐藏）、许可
  content.config.ts     # 内容 schema（构建期校验）
  content/notes/        # 文章 Markdown
  data/topics.ts        # 领域与文章类型枚举
  layouts/              # BaseLayout / ArticleLayout
  components/           # Header / Footer / 文章卡 / 筛选器等
  lib/                  # 内容过滤（发布规则唯一入口）、URL 工具
  pages/                # 首页 / notes / search / 404 / rss / robots
  styles/               # tokens / global / article
public/                 # favicon 等静态资源
docs/                   # 交接文档、写作指南、部署指南、写作计划
scripts/check-dist.mjs  # 产物校验脚本
design-reference/       # 已确认的原型（仅作视觉对照，不参与构建）
.github/workflows/      # GitHub Pages 自动部署
```

## 写作与发布

见 [docs/writing-guide.md](docs/writing-guide.md)。核心规则：

- `status: draft` 只在本地预览；生产构建完全不生成草稿页面，也不进入 RSS、sitemap 与搜索索引
- `status: published` 必须填写 `publishedAt`；未来日期的文章要等下一次构建才上线
- slug 全站唯一，小写英文、数字和连字符

## 当前测试内容（重要）

`src/content/notes/` 下除 `draft-sample.md`（草稿样例）外，另有 4 篇**已发布测试文章**，仅用于验证筛选、目录、搜索等功能，每篇正文开头都有明显的"开发测试样例"标记。**正式发布前请删除或替换为真实文章**，避免虚构内容对外展示。

## 部署

见 [docs/deployment.md](docs/deployment.md)。仓库推送到 GitHub 后，Actions 会在 main 分支推送时自动构建并部署到 GitHub Pages；PR 只做校验不部署。

## 尚未完成（待用户提供资料）

- GitHub 用户名 / 仓库地址（当前未创建远程仓库、未部署）
- 真实联系方式（email / GitHub 主页，配置在 `src/config/site.ts`，留空则页面隐藏入口）
- 正式文章（当前站点展示的是测试内容，不得视为韩飞已发表成果）
