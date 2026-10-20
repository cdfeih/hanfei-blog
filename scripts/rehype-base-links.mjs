/**
 * Markdown 正文也需要适配部署子路径。只修改 HTML 树里的站内 href/src，
 * 不修改代码示例、外链、锚点或已经包含 base 的地址。
 *
 * @param {{ base?: string }} options
 */
export default function rehypeBaseLinks({ base = '/' } = {}) {
  const prefix = base.replace(/\/+$/, '');

  /** @param {string} url */
  function withBase(url) {
    if (!prefix || !url.startsWith('/') || url.startsWith('//')) return url;
    const pathname = url.split(/[?#]/, 1)[0];
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return url;
    return `${prefix}${url}`;
  }

  /**
   * @typedef {{ type: string, properties?: Record<string, unknown>, children?: HtmlNode[] }} HtmlNode
   * @param {HtmlNode} node
   */
  function visit(node) {
    if (node.type === 'element' && node.properties) {
      for (const key of ['href', 'src']) {
        const value = node.properties[key];
        if (typeof value === 'string') node.properties[key] = withBase(value);
      }
    }
    for (const child of node.children ?? []) visit(child);
  }

  return visit;
}
