const toggle = document.querySelector('.theme-toggle');
let savedTheme = null;
try { savedTheme = localStorage.getItem('hanfei-theme'); } catch {}
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme(dark) {
  document.body.classList.toggle('dark', dark);
  toggle?.setAttribute('aria-pressed', String(dark));
  toggle?.setAttribute('aria-label', dark ? '切换浅色模式' : '切换深色模式');
}
applyTheme(savedTheme ? savedTheme === 'dark' : prefersDark.matches);
toggle?.addEventListener('click', () => {
  const dark = !document.body.classList.contains('dark');
  applyTheme(dark);
  savedTheme = dark ? 'dark' : 'light';
  try { localStorage.setItem('hanfei-theme', savedTheme); } catch {}
});
prefersDark.addEventListener('change', event => { if (!savedTheme) applyTheme(event.matches); });
document.querySelectorAll('.copy-code').forEach(button => {
  button.addEventListener('click', async () => {
    const code = button.closest('.code-block').querySelector('code').textContent;
    try {
      await navigator.clipboard.writeText(code);
      button.textContent = '已复制';
    } catch { button.textContent = '请选中代码复制'; }
    setTimeout(() => { button.textContent = '复制'; }, 2500);
  });
});
const sections = document.querySelectorAll('.prose h2[id]');
if (sections.length && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    const current = entries.find(entry => entry.isIntersecting);
    if (!current) return;
    document.querySelectorAll('.toc a').forEach(link => {
      const active = link.getAttribute('href') === `#${current.target.id}`;
      link.classList.toggle('current', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }, { rootMargin: '-15% 0px -55% 0px' });
  sections.forEach(section => observer.observe(section));
}

// 分类筛选同时覆盖可读草稿和选题规划，不将规划冒充已发布文章。
const topicButtons = [...document.querySelectorAll('[data-topic]')];
if (topicButtons.length) {
  const entries = [...document.querySelectorAll('[data-topics]')];
  const summary = document.querySelector('.filter-summary');
  const empty = document.querySelector('.writing-empty');
  const plannedHeading = document.querySelector('.planned-heading');
  function selectTopic(topic) {
    const selected = topicButtons.find(button => button.dataset.topic === topic);
    if (!selected) return;
    topicButtons.forEach(button => {
      button.setAttribute('aria-pressed', String(button === selected));
    });
    const visible = entries.filter(entry => {
      const matches = topic === 'all' || entry.dataset.topics.split(' ').includes(topic);
      entry.hidden = !matches;
      return matches;
    });
    const drafts = visible.filter(entry => entry.classList.contains('featured')).length;
    const planned = visible.length - drafts;
    plannedHeading.hidden = planned === 0;
    empty.hidden = visible.length > 0;
    summary.hidden = false;
    summary.textContent = `${selected.textContent} · ${drafts} 篇可读草稿 · ${planned} 个选题规划`;
  }
  topicButtons.forEach(button => button.addEventListener('click', () => selectTopic(button.dataset.topic)));
  document.querySelector('[data-reset-topic]').addEventListener('click', () => {
    selectTopic('all');
    topicButtons[0].focus({ preventScroll: true });
  });
}
