# GitHub Pages 部署指南

网站是纯静态产物，由 GitHub Actions 自动构建并发布到 GitHub Pages。不要求购买服务器或域名；GitHub Pages 不能运行 Node/Java 等后端服务。

## 首次部署

1. **创建仓库**：在 GitHub 上创建一个新仓库
   - 用户站点：`<username>.github.io`（网站地址为根路径）
   - 项目站点：任意仓库名如 `hanfei-blog`（网站地址为 `https://<username>.github.io/hanfei-blog/`）
   - 网站与 SE-MBSE 源码保持独立，不要把内部代码放进同一仓库
2. **推送代码**：
   ```bash
   git init
   git remote add origin git@github.com:<username>/<repo>.git
   git add .
   git commit -m "init: 韩飞个人网站"
   git push -u origin main
   ```
3. **开启 Pages**：仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**
4. **自动部署**：`.github/workflows/deploy.yml` 会自动推导站点地址：
   - 仓库 `<username>.github.io` → `https://<username>.github.io`，base `/`
   - 其他仓库 → `https://<username>.github.io/<repo>`，base `/<repo>/`
   - 如需覆盖，可在仓库 Settings → Secrets and variables → Actions → Variables 中配置 `SITE_URL`（完整站点地址）与 `BASE_PATH`
5. **验证**：Actions 运行完成后，从公网直接打开一篇文章的深层路径并刷新，确认正常显示且资源无 404

## 日常更新

推送（merge PR）到 `main` 即自动构建部署；PR 只做校验，不会部署。也可以在 Actions 页面手动触发 workflow_dispatch。

## 查看失败日志

1. 仓库 Actions 页 → 点击失败的运行 → 展开 `build` 任务
2. 常见失败原因：
   - `astro check`：类型或内容 schema 错误（重复 slug、缺发布日期、非法领域等，日志会给出具体文件）
   - `Verify dist`：产物检查失败（草稿泄漏、链接缺 base 前缀、关键文件缺失）
   - 依赖安装失败：锁文件与代码不一致（请用 pnpm 提交锁文件）

## 回退

恢复到已知正常的提交并重新构建部署：

```bash
git revert <commit-sha>   # 或 git reset 到正常提交后 force push（谨慎）
git push
```

新的 Actions 运行完成即完成回退。**不要**手动改 Pages 设置或用本地 dist 覆盖部署。

## 注意事项

- CI 构建必须提供真实站点地址：workflow 会自动推导或读取仓库变量 `SITE_URL`，缺失时构建失败（防止占位域名进入公开产物）
- 本地构建未设置 `SITE_URL` 时使用占位域名，仅供验证，不可发布
- Pages 仅托管静态文件：不要把后端服务、数据库或密钥放进本仓库
- 部署环境权限最小化：workflow 仅申请 contents 读取、pages 写入与 id-token 写入
