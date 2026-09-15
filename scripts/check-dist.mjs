#!/usr/bin/env node
/**
 * 生产产物检查：
 * 1. 关键文件存在（首页/列表/文章/搜索/404/RSS/robots/sitemap/搜索索引）
 * 2. 草稿隔离：dist 中不得出现草稿唯一标识
 * 3. 不得包含 localhost / 原型目录引用
 * 4. 子路径部署时，所有站内绝对链接必须带 base 前缀
 * 5. 严格模式（CI，STRICT_SITE=1）：禁止占位域名
 */
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const dist = join(process.cwd(), 'dist');
const base = (process.env.BASE_PATH ?? '/').replace(/\/$/, '');
const strict = process.env.STRICT_SITE === '1';

const errors = [];
const warnings = [];

function fail(msg) {
  errors.push(msg);
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

if (!existsSync(dist)) {
  console.error(`[check-dist] 未找到 ${dist}，请先执行构建。`);
  process.exit(1);
}

const files = walk(dist);
const textFiles = files.filter((f) =>
  ['.html', '.xml', '.txt', '.js', '.mjs', '.css', '.json'].includes(extname(f))
);

/* 1. 关键文件 */
const required = [
  'index.html',
  '404.html',
  'notes/index.html',
  'search/index.html',
  'rss.xml',
  'robots.txt',
  'pagefind/pagefind.js',
  'favicon.svg',
];
const normalize = (p) => p.split(/[\\/]/).slice(-3).join('/');
for (const rel of required) {
  const hit = files.some((f) => f.replaceAll('\\', '/').endsWith(rel));
  if (!hit) fail(`缺少关键产物：${rel}`);
}
const sitemapHit = files.some(
  (f) => f.endsWith('sitemap-index.xml') || /sitemap.*\.xml/.test(f)
);
if (!sitemapHit) fail('缺少 sitemap 产物');

/* 2. 草稿隔离 */
const DRAFT_MARKER = 'hf-draft-isolation-check-2026';
const draftSlugHit = files.some((f) => f.replaceAll('\\', '/').includes('notes/draft-sample'));
if (draftSlugHit) fail('dist 中存在草稿页面：notes/draft-sample/');
for (const f of textFiles) {
  const content = readFileSync(f, 'utf8');
  if (content.includes(DRAFT_MARKER)) {
    fail(`草稿唯一标识出现在产物中：${normalize(f)}`);
    break;
  }
}

/* 3. 本地/原型残留 */
for (const f of textFiles) {
  const content = readFileSync(f, 'utf8');
  if (content.includes('127.0.0.1:4327') || content.includes('design-reference')) {
    fail(`产物包含本地/原型引用：${normalize(f)}`);
    break;
  }
}

/* 4. base 前缀检查 */
const htmlFiles = files.filter((f) => f.endsWith('.html'));
for (const f of htmlFiles) {
  const content = readFileSync(f, 'utf8');
  const attrRe = /(?:href|src)="(\/[^"]*)"/g;
  let m;
  while ((m = attrRe.exec(content)) !== null) {
    const url = m[1];
    if (url.startsWith('//')) continue; // 协议相对
    if (base === '') continue; // 根路径部署无需前缀
    if (url === base || url.startsWith(`${base}/`)) continue;
    fail(`子路径部署下链接缺少 base 前缀 ${base}：${url}（${normalize(f)}）`);
  }
}

/* 5. 占位域名（CI 严格模式） */
const PLACEHOLDER = 'hanfei.example.com';
if (strict) {
  for (const f of textFiles) {
    const content = readFileSync(f, 'utf8');
    if (content.includes(PLACEHOLDER)) {
      fail(`CI 产物包含占位域名 ${PLACEHOLDER}：${normalize(f)}`);
      break;
    }
  }
} else {
  for (const f of textFiles) {
    const content = readFileSync(f, 'utf8');
    if (content.includes(PLACEHOLDER)) {
      warnings.push(`产物包含占位域名（仅限本地验证，禁止发布）：${normalize(f)}`);
      break;
    }
  }
}

for (const w of warnings) console.warn(`[check-dist] 警告：${w}`);
if (errors.length > 0) {
  console.error(`[check-dist] 检查失败，共 ${errors.length} 项：`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`[check-dist] 通过：${files.length} 个文件，关键产物齐全，草稿隔离与 base 前缀检查通过。`);
