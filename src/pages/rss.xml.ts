import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import { SITE } from '../config/site';
import { withBase } from '../lib/urls';

/**
 * RSS：仅包含已发布且发布日期不早于构建日期的文章（统一走公开内容过滤）。
 * link 使用 withBase 处理子路径部署。
 */
export const GET: APIRoute = async (context) => {
  const today = new Date().toISOString().slice(0, 10);
  const notes = await getCollection('notes', (note) => {
    const d = note.data;
    return d.status === 'published' && !!d.publishedAt && d.publishedAt <= today;
  });
  notes.sort((a, b) => (b.data.publishedAt ?? '').localeCompare(a.data.publishedAt ?? ''));

  return rss({
    title: SITE.name,
    description: SITE.description,
    site: context.site ?? '',
    items: notes.map((note) => ({
      title: note.data.title,
      description: note.data.description,
      link: withBase(`/notes/${note.data.slug}/`),
      pubDate: new Date(`${note.data.publishedAt}T00:00:00Z`),
      categories: [...note.data.topics],
    })),
    customData: '<language>zh-CN</language>',
    trailingSlash: true,
  });
};
