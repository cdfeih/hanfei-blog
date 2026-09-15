import type { APIRoute } from 'astro';
import { absoluteUrl } from '../lib/urls';

/** robots.txt 动态生成：sitemap 地址跟随 base 与域名，避免写死错误路径。 */
export const GET: APIRoute = () => {
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${absoluteUrl('/sitemap-index.xml')}`,
    '',
  ].join('\n');
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
