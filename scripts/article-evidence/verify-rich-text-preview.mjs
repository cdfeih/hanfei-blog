// Executes the committed sanitizer and cache in real Chromium, without loading SE-MBSE.
// Usage: node scripts/article-evidence/verify-rich-text-preview.mjs /path/to/SE-MBSE
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import ts from 'typescript';
import { chromium } from 'playwright';

const repo = resolve(process.argv[2] ?? '../shareetech/SE-MBSE');
const commit = '4918e0d27813a06f7496bd387758e7f3d474ed20';
const sourcePath = 'client/src/common/components/quillEditor/richTextPreview.tsx';
const source = execFileSync('git', ['-C', repo, 'show', `${commit}:${sourcePath}`], {encoding:'utf8'});
const pkg = JSON.parse(readFileSync(resolve(repo, 'client/node_modules/dompurify/package.json'), 'utf8'));
assert.equal(pkg.version, '3.4.12', 'Use the DOMPurify version pinned by the source commit.');
const boundary = source.indexOf('interface RichTextPreviewProps');
assert.ok(boundary > 0);
// Remove only module imports/export and the React presentation part. Preserve sanitizer and cache.
const snippet = source.slice(0, boundary)
  .replace(/^import .*\r?\n/gm, '')
  .replace('export function sanitizeRichText', 'function sanitizeRichText');
const javascript = ts.transpileModule(snippet, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const browser = await chromium.launch({channel:'chrome', headless:true});
try {
  const page = await browser.newPage();
  await page.route('**/*', route => route.abort()); // No untrusted fixture may send requests.
  await page.setContent('<!doctype html><title>Isolated sanitizer checks</title>');
  await page.addScriptTag({content:readFileSync(resolve(repo, 'client/node_modules/dompurify/dist/purify.js'), 'utf8')});
  const checks = await page.evaluate(({javascript}) => {
    const api = new Function('createDOMPurify', javascript + `
      return {sanitize: sanitizeRichText,
        stats: () => ({entries: htmlCache.size, size: cacheSize}),
        has: key => htmlCache.has(key)};
    `)(window.DOMPurify);
    const passed = [];
    const check = (name, condition) => {
      if (!condition) throw new Error(name);
      passed.push(name);
    };
    const parse = html => {
      const template = document.createElement('template');
      template.innerHTML = html;
      return template.content;
    };
    let fragment = parse(api.sanitize('<p onclick="alert(1)">ok<script>alert(1)</script></p>'));
    check('script and event attributes removed', !fragment.querySelector('script,[onclick]'));
    fragment = parse(api.sanitize('<p class="ql-align-center foreign" style="color:red;position:fixed;background-image:url(https://invalid.example/x)">ok</p>'));
    check('allowed Quill class and color preserved', fragment.firstChild.className === 'ql-align-center' && fragment.firstChild.style.color === 'red');
    check('layout and image CSS removed', !fragment.firstChild.style.position && !fragment.firstChild.style.backgroundImage);
    fragment = parse(api.sanitize('<a href="javascript:alert(1)" target="_blank">link</a>'));
    check('active link removed and rel applied', !fragment.firstChild.hasAttribute('href') && fragment.firstChild.getAttribute('rel') === 'noopener noreferrer');
    fragment = parse(api.sanitize('<img src="data:image/svg+xml;base64,PHN2Zy8+">'));
    check('SVG data image rejected', !fragment.firstChild.hasAttribute('src'));
    fragment = parse(api.sanitize('<img src="/uploads\\diagram.png">'));
    check('legacy backslash path normalized', fragment.firstChild.getAttribute('src') === '/uploads/diagram.png');
    const first = api.sanitize('<p>cache probe</p>');
    const before = api.stats();
    check('cache hit returns same sanitized value', api.sanitize('<p>cache probe</p>') === first);
    check('cache hit does not double count', JSON.stringify(before) === JSON.stringify(api.stats()));
    for (let i = 0; i < 210; i++) api.sanitize(`<p>entry ${i}</p>`);
    check('entry count bounded and oldest evicted', api.stats().entries === 200 && !api.has('<p>cache probe</p>'));
    api.sanitize('<p>entry 10</p>');
    api.sanitize('<p>new entry</p>');
    check('cache hit refreshes LRU order', api.has('<p>entry 10</p>') && !api.has('<p>entry 11</p>'));
    for (let i = 0; i < 20; i++) api.sanitize(`<p>${i}:${'x'.repeat(40_000)}</p>`);
    check('combined input and output character budget bounded', api.stats().size <= 1_000_000 && api.stats().entries < 200);
    const oversized = '<p>' + 'x'.repeat(600_000) + '</p>';
    check('oversized result still renders but is not cached', api.sanitize(oversized).includes('x'.repeat(100)) && !api.has(oversized));
    return passed;
  }, {javascript});
  console.log(JSON.stringify({
    commit, sourcePath,
    sourceSha256:createHash('sha256').update(source).digest('hex'),
    dompurify:pkg.version, chromium:browser.version(),
    checks, passed:checks.length,
    scope:'Sanitizer/cache only; not full application, XSS audit, virtualization or performance benchmark.',
  }, null, 2));
} finally {
  await browser.close();
}
