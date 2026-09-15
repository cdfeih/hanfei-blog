// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

/**
 * 域名与子路径通过环境变量配置：
 * - SITE_URL：正式站点完整地址，如 https://<username>.github.io/hanfei-blog/
 *   CI 构建必须提供；本地构建缺省时使用占位域名（仅限本地验证，禁止发布）。
 * - BASE_PATH：GitHub Pages 子路径，如 /hanfei-blog；缺省时从 SITE_URL 路径推导。
 */
const PLACEHOLDER_SITE = 'https://hanfei.example.com';
// 仅 GitHub Actions 上的正式构建强制要求 SITE_URL；本地验证构建使用占位域名。
const isGithubActions = process.env.GITHUB_ACTIONS === 'true';

const SITE_URL = process.env.SITE_URL?.trim() || '';
if (isGithubActions && !SITE_URL) {
  throw new Error(
    '[astro.config] CI 构建必须提供 SITE_URL（例如 https://<username>.github.io/hanfei-blog/），避免占位域名进入公开产物。'
  );
}

const site = SITE_URL || PLACEHOLDER_SITE;
if (!SITE_URL) {
  console.warn(
    `[astro.config] 未设置 SITE_URL，本次构建使用占位域名 ${PLACEHOLDER_SITE}（仅限本地验证，不可发布）。`
  );
}

let base = process.env.BASE_PATH?.trim() || '';
if (!base) {
  try {
    base = new URL(site).pathname.replace(/\/+$/, '');
  } catch {
    base = '';
  }
}
if (base === '' || base === '/') base = '/';

export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/search') && !page.includes('/404'),
    }),
  ],
  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      wrap: false,
    },
  },
  build: {
    format: 'directory',
  },
});
