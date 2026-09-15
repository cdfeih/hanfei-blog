/** 基础路径与绝对地址工具：全站链接必须经过这里，禁止硬编码 /styles.css 之类的路径。 */

/** Astro 注入的 base（'/' 或 '/hanfei-blog'） */
const RAW_BASE = import.meta.env.BASE_URL ?? '/';
export const BASE = RAW_BASE.endsWith('/') && RAW_BASE !== '/' ? RAW_BASE.slice(0, -1) : RAW_BASE;
const BASE_NO_SLASH = BASE === '/' ? '' : BASE;

/** 站点地址（构建期确定；CI 必填，本地为占位域名，禁止发布） */
export const SITE_URL: string = import.meta.env.SITE ?? '';

/**
 * 为路径添加 base 前缀。
 * 已带 base 的路径原样返回；'/' 映射到 base 根。
 */
export function withBase(path = '/'): string {
  if (!path.startsWith('/')) path = `/${path}`;
  if (BASE_NO_SLASH === '') return path;
  if (path === '/') return `${BASE_NO_SLASH}/`;
  if (path === BASE_NO_SLASH || path.startsWith(`${BASE_NO_SLASH}/`)) return path;
  return `${BASE_NO_SLASH}${path}`;
}

/** 基于站点域名生成绝对地址（canonical / RSS / sitemap 用）。 */
export function absoluteUrl(path = '/'): string {
  return new URL(withBase(path), SITE_URL).toString();
}

/** 供客户端脚本使用的搜索索引地址（在页面上以 data 属性下发，避免再引构建期常量）。 */
export const PAGEFIND_ENTRY = withBase('/pagefind/pagefind.js');
