import assert from 'node:assert/strict';
import test from 'node:test';
import rehypeBaseLinks from './rehype-base-links.mjs';

function render(properties, base = '/hanfei-blog') {
  const tree = {
    type: 'root',
    children: [{ type: 'element', tagName: 'p', children: [
      { type: 'element', tagName: 'a', properties: { ...properties } },
    ] }],
  };
  rehypeBaseLinks({ base })(tree);
  return tree.children[0].children[0].properties;
}

test('GitHub Pages 子路径下转换正文、附件和图片地址', () => {
  assert.deepEqual(render({ href: '/notes/next/?from=article#section', src: '/images/chart.svg' }), {
    href: '/hanfei-blog/notes/next/?from=article#section',
    src: '/hanfei-blog/images/chart.svg',
  });
  assert.equal(render({ href: '/examples/lab/README.md' }).href, '/hanfei-blog/examples/lab/README.md');
  assert.equal(render({ href: '/?view=all#top' }).href, '/hanfei-blog/?view=all#top');
});

test('根路径部署保持原地址，不修改外链、相对路径和锚点', () => {
  for (const href of ['/', '/notes/next/', 'https://example.org/a', '//cdn.example.org/a', '#section', '../../examples/lab/', 'mailto:test@example.org']) {
    assert.equal(render({ href }, '/').href, href);
  }
  for (const href of ['https://example.org/a', '//cdn.example.org/a', '#section', '../../examples/lab/', 'mailto:test@example.org']) {
    assert.equal(render({ href }).href, href);
  }
});

test('重复转换不叠加前缀，区分相似目录名，保留查询和锚点', () => {
  for (const href of ['/hanfei-blog', '/hanfei-blog/', '/hanfei-blog?view=all', '/hanfei-blog#top', '/hanfei-blog/notes/a/']) {
    assert.equal(render({ href }, '/hanfei-blog/').href, href);
  }
  assert.equal(render({ href: '/hanfei-blog-other/a' }).href, '/hanfei-blog/hanfei-blog-other/a');
  const once = render({ href: '/notes/a/' });
  assert.deepEqual(render(once), once);
});

test('只改链接属性，不改代码示例与正文文本', () => {
  const tree = {
    type: 'root',
    children: [{
      type: 'element', tagName: 'code', properties: { className: ['language-html'] },
      children: [{ type: 'text', value: '<a href="/notes/demo/">示例</a>' }],
    }],
  };
  const original = structuredClone(tree);
  rehypeBaseLinks({ base: '/hanfei-blog' })(tree);
  assert.deepEqual(tree, original);
});
