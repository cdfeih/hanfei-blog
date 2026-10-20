import type { AssistantEvent } from './types'

/** POST SSE 使用 fetch 读取，支持跨网络块、UTF-8 多字节和 CRLF。 */
export async function readAssistantEvents(
  response: Response,
  onEvent: (event: AssistantEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) {
    let message = `助手请求失败（${response.status}）`
    try {
      const body = await response.json()
      message = body.message || body.msg || message
    } catch {
      // 代理返回 HTML 时仍显示可读的 HTTP 错误，不将页面内容加入对话。
    }
    throw new Error(message)
  }
  if (!response.body) throw new Error('服务器未返回对话流')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let terminated = false
  const emitFrame = (frame: string) => {
    const data = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''))
      .join('\n')
    if (!data || data === '[DONE]') return
    let event: AssistantEvent
    try {
      event = JSON.parse(data)
    } catch {
      throw new Error('服务器返回了无法解析的对话事件')
    }
    if (!event || typeof event.type !== 'string') throw new Error('对话事件缺少类型')
    if (
      event.type === 'complete' ||
      event.type === 'error' ||
      event.type === 'confirmation' ||
      event.type === 'question'
    ) {
      terminated = true
    }
    onEvent(event)
  }
  const cancelReader = () => {
    void reader.cancel().catch(() => {})
  }
  signal?.addEventListener('abort', cancelReader, { once: true })
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException('已停止', 'AbortError')
      const { value, done } = await reader.read()
      if (signal?.aborted) throw new DOMException('已停止', 'AbortError')
      buffer += decoder.decode(value, { stream: !done })
      let separator = /\r?\n\r?\n/.exec(buffer)
      while (separator) {
        emitFrame(buffer.slice(0, separator.index))
        // 业务终态即可释放界面，不能等待代理或服务器关闭 HTTP 连接。
        if (terminated) return
        buffer = buffer.slice(separator.index + separator[0].length)
        separator = /\r?\n\r?\n/.exec(buffer)
      }
      if (done) break
    }
    if (buffer.trim()) emitFrame(buffer)
    if (!terminated) throw new Error('连接已中断，执行结果待核对；请检查工具记录后再继续')
  } finally {
    signal?.removeEventListener('abort', cancelReader)
    cancelReader()
    reader.releaseLock()
  }
}
