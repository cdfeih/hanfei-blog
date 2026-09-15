/**
 * 页面交互 E2E 测试（Playwright + Chromium，针对本地 preview 生产构建）。
 * 运行：node tests/e2e.mjs   （需先 pnpm build && pnpm preview）
 * 覆盖：主题切换、导航高亮、列表筛选（D07）、锚点偏移（D05）、
 *       目录高亮与手机目录（D04）、代码复制、搜索、404、移动端布局。
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:4321';
const results = [];

async function test(name, fn) {
  try {
    await fn();
    results.push({ name, pass: true });
    console.log(`PASS  ${name}`);
  } catch (err) {
    results.push({ name, pass: false, error: err });
    console.log(`FAIL  ${name}\n      ${err.message.split('\n')[0]}`);
  }
}

function expect(cond, msg) {
  if (!cond) throw new Error(msg ?? '断言失败');
}

/* 可见的列表项（未 hidden 的文章行 href） */
const visibleNotes = (page) =>
  page.$$eval('[data-note]', (els) =>
    els.filter((e) => !e.hidden).map((e) => e.getAttribute('href'))
  );

/* 优先使用系统已安装的 Chrome（channel: 'chrome'），未安装时回退到 Playwright Chromium */
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome' });
  console.log('使用系统 Chrome 运行测试');
} catch {
  browser = await chromium.launch();
  console.log('使用 Playwright Chromium 运行测试');
}
const pickArticle = async (page) => {
  await page.goto(`${BASE}/notes/`);
  await page.click('[data-topic="modeling"]');
  await page.click('[data-note]:not([hidden])');
  await page.waitForLoadState('load');
};

/* ---------- A. 主题切换与持久化 ---------- */
{
  const ctx = await browser.newContext({ colorScheme: 'light' });
  const page = await ctx.newPage();

  await test('A1 首页加载后 html 存在 data-theme', async () => {
    await page.goto(BASE);
    const theme = await page.getAttribute('html', 'data-theme');
    expect(theme === 'light' || theme === 'dark', `data-theme=${theme}`);
  });

  await test('A2 点击切换按钮：主题翻转并写入 localStorage', async () => {
    const before = await page.getAttribute('html', 'data-theme');
    await page.click('[data-theme-toggle]');
    const after = await page.getAttribute('html', 'data-theme');
    expect(before !== after, `切换前 ${before} / 切换后 ${after}`);
    const pressed = await page.getAttribute('[data-theme-toggle]', 'aria-pressed');
    expect(pressed === String(after === 'dark'), `aria-pressed=${pressed}`);
    const stored = await page.evaluate(() => localStorage.getItem('hanfei-theme'));
    expect(stored === after, `localStorage=${stored}`);
  });

  await test('A3 刷新后主题保持（无闪烁初始化）', async () => {
    await page.reload();
    const theme = await page.getAttribute('html', 'data-theme');
    const stored = await page.evaluate(() => localStorage.getItem('hanfei-theme'));
    expect(theme === stored, `刷新后 data-theme=${theme}，storage=${stored}`);
  });

  await ctx.close();
}

/* ---------- B. 导航高亮（D06） ---------- */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await test('B1 /notes/ 高亮“工程笔记”（aria-current=page）', async () => {
    await page.goto(`${BASE}/notes/`);
    const cur = await page.getAttribute('a[data-navkey="notes"]', 'aria-current');
    expect(cur === 'page', `aria-current=${cur}`);
  });

  await test('B2 首页顶部高亮“首页”', async () => {
    await page.goto(BASE);
    await page.waitForFunction(
      () => document.querySelector('a[data-navkey="home"]')?.getAttribute('aria-current'),
      null,
      { timeout: 3000 }
    );
  });

  await test('B3 滚动到“关于”区块后高亮“关于”', async () => {
    await page.evaluate(() => document.getElementById('about').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(500);
    const aboutCur = await page.getAttribute('a[href$="#about"]', 'aria-current');
    expect(aboutCur === 'true', `关于 aria-current=${aboutCur}`);
    await page.evaluate(() => document.getElementById('project').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(500);
    const projCur = await page.getAttribute('a[href$="#project"]', 'aria-current');
    expect(projCur === 'true', `项目实践 aria-current=${projCur}`);
  });

  await ctx.close();
}

/* ---------- C. 列表筛选（D07：URL 状态） ---------- */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await test('C1 列表初始展示全部 4 篇并显示计数', async () => {
    await page.goto(`${BASE}/notes/`);
    const vis = await visibleNotes(page);
    expect(vis.length === 4, `可见 ${vis.length} 篇`);
    const note = await page.textContent('[data-count-note]');
    expect(note.includes('4'), `计数文本：“${note.trim()}”`);
  });

  await test('C2 点击“系统建模”→ 筛出 1 篇且 URL 带 ?topic=modeling', async () => {
    await page.click('[data-topic="modeling"]');
    await page.waitForTimeout(100);
    const vis = await visibleNotes(page);
    expect(vis.length === 1, `可见 ${vis.length} 篇`);
    expect(vis[0].includes('defining-module-boundaries'), `筛选到 ${vis[0]}`);
    expect(page.url().includes('topic=modeling'), `URL=${page.url()}`);
    const pressed = await page.getAttribute('[data-topic="modeling"]', 'aria-pressed');
    expect(pressed === 'true', `aria-pressed=${pressed}`);
  });

  await test('C3 点击“复杂前端”→ 1 篇；后退恢复“系统建模”状态', async () => {
    await page.click('[data-topic="frontend"]');
    await page.waitForTimeout(100);
    const vis = await visibleNotes(page);
    expect(vis.length === 1 && vis[0].includes('frontend-state-ownership'), `可见 ${vis.join(',')}`);
    await page.goBack();
    await page.waitForTimeout(200);
    const back = await visibleNotes(page);
    expect(back.length === 1 && back[0].includes('defining-module-boundaries'), `后退后 ${back.join(',')}`);
  });

  await test('C4 直接访问 ?topic=frontend 可恢复筛选', async () => {
    await page.goto(`${BASE}/notes/?topic=frontend`);
    await page.waitForTimeout(100);
    const vis = await visibleNotes(page);
    expect(vis.length === 1 && vis[0].includes('frontend-state-ownership'), `可见 ${vis.join(',')}`);
  });

  await test('C5 无效 topic 参数按“全部”处理', async () => {
    await page.goto(`${BASE}/notes/?topic=bogus`);
    await page.waitForTimeout(100);
    const vis = await visibleNotes(page);
    expect(vis.length === 4, `可见 ${vis.length} 篇`);
  });

  await test('C6 “全部笔记”点击后清除 URL 参数', async () => {
    await page.goto(`${BASE}/notes/?topic=modeling`);
    await page.click('[data-topic="all"]');
    await page.waitForTimeout(100);
    expect(!page.url().includes('topic='), `URL=${page.url()}`);
    const vis = await visibleNotes(page);
    expect(vis.length === 4, `可见 ${vis.length} 篇`);
  });

  await ctx.close();
}

/* ---------- D. 文章页交互 ---------- */
{
  const ctx = await browser.newContext();
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await ctx.newPage();

  await test('D1 文章页目录存在且含多个章节链接', async () => {
    await page.goto(`${BASE}/notes/defining-module-boundaries/`);
    const n = await page.$$eval('[data-toc-link]', (els) => els.length);
    expect(n >= 2, `目录链接 ${n} 个`);
  });

  await test('D2 点击目录锚点：标题滚动到位且不被导航遮挡（D05）', async () => {
    await page.goto(`${BASE}/notes/defining-module-boundaries/`);
    const firstToc = page.locator('[data-toc-link]').first();
    const target = await firstToc.getAttribute('href');
    await firstToc.click();
    await page.waitForTimeout(900); /* 平滑滚动结束 */
    const m = await page.evaluate(
      ([sel]) => {
        const h = document.querySelector('.header').getBoundingClientRect();
        const t = document.querySelector(sel).getBoundingClientRect();
        return { headerBottom: h.bottom, headingTop: t.top, hash: decodeURIComponent(location.hash) };
      },
      [target]
    );
    expect(m.hash === target, `hash=${m.hash}`);
    expect(m.headingTop >= m.headerBottom - 2, `标题 top=${m.headingTop.toFixed(1)} < 导航 bottom=${m.headerBottom.toFixed(1)}，被遮挡`);
  });

  await test('D3 点击目录项即时高亮，滚动跟踪正确', async () => {
    await page.goto(`${BASE}/notes/defining-module-boundaries/`);
    const link = page.locator('[data-toc-link]').nth(1);
    const target = await link.getAttribute('href');
    /* 场景1：点击目录项后立即高亮（滚动到达前给出反馈） */
    await link.click();
    const cls = (await link.getAttribute('class')) ?? '';
    expect(cls.includes('current'), `点击后 class="${cls}"`);
    /* 场景2：滚动使章节进入判定条带（视口 30% 位置），高亮跟随 */
    await page.evaluate(
      ([sel]) => {
        const el = document.querySelector(sel);
        window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.3);
      },
      [target]
    );
    await page.waitForTimeout(500);
    const cls2 = (await link.getAttribute('class')) ?? '';
    expect(cls2.includes('current'), `滚动后 class="${cls2}"`);
  });

  await test('D4 代码块复制按钮点击后反馈“已复制”', async () => {
    await page.goto(`${BASE}/notes/defining-module-boundaries/`);
    const btn = page.locator('.copy-code').first();
    await btn.click();
    await page.waitForFunction(
      () => document.querySelector('.copy-code')?.textContent === '已复制',
      null,
      { timeout: 4000 }
    );
    const live = await page.textContent('[data-copy-status]');
    expect(live.includes('已复制'), `aria-live 播报：“${live.trim()}”`);
  });

  await test('D5 从筛选状态进入文章，返回链接携带来源领域', async () => {
    await page.goto(`${BASE}/notes/`);
    await page.click('[data-topic="modeling"]');
    await page.click('[data-note]:not([hidden])');
    await page.waitForLoadState('load');
    const href = await page.getAttribute('[data-back-to-notes]', 'href');
    expect(href.includes('topic=modeling'), `返回链接=${href}`);
    await page.click('[data-back-to-notes]');
    await page.waitForLoadState('load');
    const vis = await visibleNotes(page);
    expect(vis.length === 1 && vis[0].includes('defining-module-boundaries'), `返回后可见 ${vis.join(',')}`);
  });

  await ctx.close();
}

/* ---------- E. 搜索 ---------- */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await test('E1 搜索页初始状态提示', async () => {
    await page.goto(`${BASE}/search/`);
    const s = await page.textContent('[data-search-status]');
    expect(s.includes('输入关键词'), `状态：“${s.trim()}”`);
  });

  await test('E2 输入“架构”出结果且 URL 同步 ?q=', async () => {
    await page.goto(`${BASE}/search/`);
    await page.fill('[data-search-input]', '架构');
    await page.waitForSelector('.search-row', { timeout: 10000 });
    const n = await page.$$eval('.search-row', (els) => els.length);
    const s = await page.textContent('[data-search-status]');
    expect(n >= 1 && s.includes('共'), `${n} 条结果，状态：“${s.trim()}”`);
    expect(page.url().includes('q='), `URL=${decodeURIComponent(page.url())}`);
  });

  await test('E3 无结果关键词显示“没有找到”', async () => {
    await page.fill('[data-search-input]', 'zzqqxyz999');
    await page.waitForFunction(
      () => document.querySelector('[data-search-status]')?.textContent.includes('没有找到'),
      null,
      { timeout: 10000 }
    );
  });

  await test('E4 带 ?q= 访问自动执行搜索', async () => {
    await page.goto(`${BASE}/search/?q=${encodeURIComponent('架构')}`);
    await page.waitForSelector('.search-row', { timeout: 10000 });
    const val = await page.inputValue('[data-search-input]');
    expect(val === '架构', `输入框="${val}"`);
  });

  await ctx.close();
}

/* ---------- F. 404 页面 ---------- */
await test('F1 访问不存在路径返回 404 页面', async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const resp = await page.goto(`${BASE}/notes/not-exist-slug/`);
  const body = await page.content();
  expect(resp.status() === 404 || body.includes('页面未找到'), `HTTP=${resp.status()}`);
  expect(body.includes('页面未找到') || body.includes('404'), '未渲染 404 内容');
  await ctx.close();
});

/* ---------- G. 移动端（375px，D04） ---------- */
{
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 667 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();

  await test('G1 手机端目录默认收起', async () => {
    await page.goto(`${BASE}/notes/defining-module-boundaries/`);
    const open = await page.getAttribute('.toc-details', 'open');
    expect(open === null, `details open=${open}`);
  });

  await test('G2 手机端 DOM 顺序：目录位于正文之前（D04）', async () => {
    const before = await page.evaluate(() => {
      const toc = document.querySelector('.article-toc');
      const prose = document.querySelector('.prose');
      return !!(toc && prose && (toc.compareDocumentPosition(prose) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    expect(before, '目录未排在正文前');
  });

  await test('G3 手机端无横向溢出（首页/列表/文章）', async () => {
    for (const p of ['/', '/notes/', '/notes/defining-module-boundaries/', '/search/']) {
      await page.goto(`${BASE}${p}`);
      const over = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(over <= 2, `${p} 溢出 ${over}px`);
    }
  });

  await ctx.close();
}

await browser.close();

/* ---------- 汇总 ---------- */
const pass = results.filter((r) => r.pass).length;
console.log(`\n===== 结果：${pass}/${results.length} 通过 =====`);
for (const r of results.filter((r) => !r.pass)) {
  console.log(`\n[FAIL] ${r.name}`);
  console.log(r.error.stack ?? r.error.message);
}
process.exit(pass === results.length ? 0 : 1);
