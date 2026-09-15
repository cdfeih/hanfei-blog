# 写作指南

## 文件位置

每篇文章是 `src/content/notes/` 下的一个 Markdown 文件（`.md` 或 `.mdx`）。

## Frontmatter 字段

```yaml
---
title: 文章标题（必填）
slug: url-slug            # 必填，唯一且长期稳定；小写英文、数字、连字符
description: 一两句话摘要（必填，列表与搜索摘要使用）
status: published          # published | draft
topics:                    # 领域，必填，至少一个
  - modeling               # modeling 系统建模 / frontend 复杂前端
  - architecture           # architecture 平台架构 / management 工程管理
kind: architecture         # 可选文章类型：architecture 架构设计 / decision 技术决策 / delivery 团队与交付
featuredOrder: 1           # 可选，编辑精选顺序（数字越小越靠前）
publishedAt: 2026-09-01    # status: published 时必填，YYYY-MM-DD
updatedAt: 2026-09-10      # 可选，确有内容更新且晚于发布日时填写
cover:                     # 可选封面
  src: /path/to/image
  alt: 图片说明文字
---
```

### 校验规则（违反会让构建失败）

- slug 重复、slug 含大写或特殊字符、领域取值不在枚举内 → 构建失败
- `status: published` 缺少 `publishedAt` → 构建失败
- `updatedAt` 早于 `publishedAt` → 构建失败

## 发布一篇文章

1. 新建 `src/content/notes/<slug>.md`，填写 frontmatter，正文用 Markdown
2. 本地 `pnpm dev` 预览（未发布的文章先写 `status: draft`，预览页顶部会显示草稿提示）
3. 确认无误后改 `status: published` 并填写 `publishedAt`
4. 提交推送 → GitHub Actions 自动构建部署

## 撤回一篇文章

- 立即下线：把 `status` 改回 `draft`（或直接删除文件），提交推送。下一次部署后文章从线上消失
- 注意：撤回不能清除搜索引擎与社交平台的既有缓存，也不承诺彻底删除历史访问痕迹

## 修改已发布文章

- 内容有实质更新时，同步更新 `updatedAt`
- slug 与发布日期保持不变，避免外链失效

## 恢复旧版本

- 通过 Git 历史回退对应文件（`git log -- src/content/notes/<slug>.md`），必要时 revert 相关提交并重新构建部署

## 草稿边界

- `draft` 状态只在本地 `pnpm dev` 可见（访问 `/notes/<slug>/` 显示草稿提示条）
- 生产构建不生成草稿页面；列表、首页、RSS、sitemap、搜索索引自动排除草稿
- `check-dist` 脚本会扫描构建产物验证草稿隔离

## 正文写作约定

- 章节：正文使用 `##`（二级）与 `###`（三级）标题，目录自动生成，重复标题会自动去重锚点
- 代码块：` ```ts ` 标注语言即可，页面自动提供复制按钮；代码高亮适配深浅色
- 表格：宽表格在自身容器内横向滚动，不影响整页布局
- 图片：提供有意义的 alt；技术图优先 SVG 或清晰截图
- 首页排序：`featuredOrder` 优先，其余按发布日期倒序
