import { getCollection, type CollectionEntry } from 'astro:content';

export type Note = CollectionEntry<'notes'>;

/** 今天的 ISO 日期（构建时间）。未来发布的文章要等下一次构建才会上线。 */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 展示排序：编辑精选顺序优先，其余按发布日期倒序。 */
export function sortForDisplay(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    const fa = a.data.featuredOrder ?? Infinity;
    const fb = b.data.featuredOrder ?? Infinity;
    if (fa !== fb) return fa - fb;
    const da = a.data.publishedAt ?? '';
    const db = b.data.publishedAt ?? '';
    if (da !== db) return db.localeCompare(da);
    return a.data.slug.localeCompare(b.data.slug);
  });
}

/**
 * 全站唯一的公开内容入口：status 为 published 且发布日期不晚于构建日期。
 * 列表、首页、RSS、相关文章都必须经过这里，保证草稿与未来文章不进入任何公开产物。
 */
export async function getPublicNotes(): Promise<Note[]> {
  const today = todayISO();
  const notes = await getCollection('notes', (note) => {
    const d = note.data;
    return d.status === 'published' && !!d.publishedAt && d.publishedAt <= today;
  });
  return sortForDisplay(notes);
}

/** 全部笔记（含草稿）。仅限本地开发预览使用；公开路由不得调用。 */
export async function getAllNotes(): Promise<Note[]> {
  return getCollection('notes');
}

/** 校验 slug 唯一，重复时让构建失败并给出明确错误。 */
export function assertUniqueSlugs(notes: Note[]): void {
  const seen = new Map<string, string>();
  for (const note of notes) {
    const prev = seen.get(note.data.slug);
    if (prev) {
      throw new Error(
        `[内容校验] 重复的文章 slug：${note.data.slug}（${prev} 与 ${note.filePath}）。slug 必须唯一且长期稳定。`
      );
    }
    seen.set(note.data.slug, note.filePath ?? note.data.slug);
  }
}

/** 按主题相关度（交集数量）与日期挑选相关文章，最多 count 篇，不含自身。 */
export function pickRelated(all: Note[], self: Note, count = 3): Note[] {
  const selfTopics = new Set(self.data.topics);
  return all
    .filter((n) => n.data.slug !== self.data.slug)
    .map((n) => ({ n, score: n.data.topics.filter((t) => selfTopics.has(t)).length }))
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.n.data.publishedAt ?? '').localeCompare(a.n.data.publishedAt ?? '')
    )
    .slice(0, count)
    .map(({ n }) => n);
}

/** 阅读时长（约 N 分钟），按中文每分钟约 400 字估算。 */
export function readingMinutes(body: string): number {
  return Math.max(1, Math.round(body.length / 400));
}
