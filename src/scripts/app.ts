/**
 * 全站客户端脚本：
 * 1. 主题切换（用户选择 > 系统偏好；存储失败静默降级）
 * 2. 导航实测高度写入 CSS 变量，保证锚点偏移 = 导航高度 + 16px（D05）
 * 3. 首页滚动时更新导航高亮（D06）：项目实践 / 关于；其余状态高亮首页
 */

/* ---------- 主题 ---------- */
const toggle = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');

function applyTheme(dark: boolean): void {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  if (toggle) {
    toggle.setAttribute('aria-pressed', String(dark));
    toggle.setAttribute('aria-label', dark ? '切换浅色模式' : '切换深色模式');
  }
}

let savedTheme: string | null = null;
try {
  savedTheme = localStorage.getItem('hanfei-theme');
} catch {
  /* 存储不可用时忽略 */
}
applyTheme(savedTheme ? savedTheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches);

toggle?.addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  applyTheme(dark);
  try {
    localStorage.setItem('hanfei-theme', dark ? 'dark' : 'light');
  } catch {
    /* 忽略写入失败 */
  }
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem('hanfei-theme');
  } catch {
    /* 忽略 */
  }
  if (!stored) applyTheme(event.matches);
});

/* ---------- 导航高度 → 锚点偏移（D05） ---------- */
const header = document.querySelector<HTMLElement>('.header');
if (header && 'ResizeObserver' in window) {
  const update = () => {
    document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
  };
  update();
  new ResizeObserver(update).observe(header);
} else if (header) {
  document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
}

/* ---------- 首页滚动高亮（D06） ---------- */
const nav = document.querySelector<HTMLElement>('.nav');
if (document.documentElement.dataset.page === 'home' && nav) {
  const links = new Map<string, HTMLAnchorElement>();
  nav.querySelectorAll<HTMLAnchorElement>('a[data-navkey]').forEach((a) => {
    if (a.dataset.navkey) links.set(a.dataset.navkey, a);
  });

  const setCurrent = (key: 'home' | 'project' | 'about') => {
    nav.querySelectorAll<HTMLAnchorElement>('a[data-navkey]').forEach((a) => {
      const target = a.dataset.navkey;
      const isCurrent =
        (key === 'home' && target === 'home') ||
        (key === 'project' && target === undefined && a.getAttribute('href')?.includes('#project')) ||
        (key === 'about' && target === undefined && a.getAttribute('href')?.includes('#about'));
      if (isCurrent) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  };

  const sections = ['about', 'project', 'writing']
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => !!el);

  if (sections.length && 'IntersectionObserver' in window) {
    // 命中视口中部的区块决定高亮；未命中任何区块（页面顶部）时高亮首页
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        if (visible.has('about')) setCurrent('about');
        else if (visible.has('project')) setCurrent('project');
        else setCurrent('home');
      },
      { rootMargin: '-25% 0px -45% 0px' }
    );
    sections.forEach((s) => observer.observe(s));
  }
}

/* ---------- 手机文章目录默认收起 ---------- */
const tocDetails = document.querySelector<HTMLDetailsElement>('.toc-details');
if (tocDetails && window.matchMedia('(max-width: 760px)').matches) {
  tocDetails.removeAttribute('open');
}
