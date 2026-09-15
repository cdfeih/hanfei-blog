---
title: 草稿样例：写作与发布流程验证
slug: draft-sample
description: 一篇明确标记的草稿样例，用于验证草稿只在本地预览、不进入任何公开产物。
status: draft
topics: [modeling, frontend]
kind: architecture
---

> 本文为草稿样例，仅本地开发可见。草稿隔离校验标识：hf-draft-isolation-check-2026

## 这篇草稿的用途

验证以下行为：

1. 本地 `pnpm dev` 可以直接访问 `/notes/draft-sample/`，页面显示草稿提示
2. 生产构建（`pnpm build`）不生成该页面
3. 列表、首页、RSS、sitemap、搜索索引中都不出现这篇草稿
4. `check-dist` 脚本会在 dist 中搜索上方唯一标识，发现即构建失败

## 后续写作计划（示例）

- 补充真实场景
- 补充决策依据
- 确认可公开后再把 status 改为 published 并填写 publishedAt
