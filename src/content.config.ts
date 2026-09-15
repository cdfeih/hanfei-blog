import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { TOPIC_VALUES } from './data/topics';

/** 日期字段：兼容 YAML 未加引号的 Date 与字符串，统一输出 YYYY-MM-DD。 */
const isoDate = z.preprocess((value) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD'));

/**
 * 工程笔记内容模型（规格 §5.3）。
 * 构建期校验：重复 slug、未知领域、已发布缺日期、无效日期、更新早于发表都会让构建失败。
 */
const notes = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/notes' }),
  schema: z
    .object({
      title: z.string().min(1),
      slug: z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug 只允许小写英文、数字和连字符'),
      description: z.string().min(1),
      status: z.enum(['draft', 'published']),
      topics: z.array(z.enum(TOPIC_VALUES as [string, ...string[]])).min(1),
      kind: z.enum(['architecture', 'decision', 'delivery']).optional(),
      featuredOrder: z.number().int().positive().optional(),
      publishedAt: isoDate.optional(),
      updatedAt: isoDate.optional(),
      cover: z.object({ src: z.string(), alt: z.string() }).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.status === 'published' && !data.publishedAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['publishedAt'],
          message: '已发布文章必须填写 publishedAt（YYYY-MM-DD）',
        });
      }
      if (data.updatedAt && data.publishedAt && data.updatedAt < data.publishedAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['updatedAt'],
          message: 'updatedAt 不能早于 publishedAt',
        });
      }
    }),
});

export const collections = { notes };
