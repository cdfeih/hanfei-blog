/** 树上的收藏前缀与虚拟导航节点不属于 MCP 业务 ID；始终保留字符串精度。 */
export function getAssistantSelectedIds(elements: { dataId?: string }[]): string[] {
  const ids = elements
    .map((element) => element.dataId?.replace(/^FAVORIATE-/, ''))
    .filter((id): id is string => {
      if (!id || !/^[1-9][0-9]{0,18}$/.test(id)) return false
      return id.length < 19 || id <= '9223372036854775807'
    })
  return [...new Set(ids)]
}
