import type { KeyValue, SseMessage } from '../../../shared/types'
import { v4 as uuidv4 } from 'uuid'
import { secureFetch } from './http-fetch.service'

interface SseConnection {
  abort: AbortController
  messages: SseMessage[]
}

const connections = new Map<string, SseConnection>()

function buildHeaders(headers: KeyValue[]): Record<string, string> {
  const map: Record<string, string> = { Accept: 'text/event-stream' }
  for (const h of headers) {
    if (h.enabled && h.key) map[h.key] = h.value
  }
  return map
}

export async function connectSse(
  url: string,
  headers: KeyValue[],
  onMessage: (connectionId: string, message: SseMessage) => void
): Promise<string> {
  const id = uuidv4()
  const abort = new AbortController()
  const conn: SseConnection = { abort, messages: [] }
  connections.set(id, conn)

  void (async () => {
    try {
      const response = await secureFetch(
        url,
        {
          method: 'GET',
          headers: buildHeaders(headers),
          signal: abort.signal
        },
        {}
      )

      if (!response.body) throw new Error('No response body for SSE stream')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let eventName = 'message'

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        let boundary = buffer.indexOf('\n\n')
        while (boundary >= 0) {
          const chunk = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          const lines = chunk.split('\n')
          const dataLines: string[] = []
          eventName = 'message'

          for (const line of lines) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim()
            if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
          }

          if (dataLines.length > 0) {
            const msg: SseMessage = {
              id: uuidv4(),
              event: eventName,
              data: dataLines.join('\n'),
              timestamp: Date.now()
            }
            conn.messages.push(msg)
            onMessage(id, msg)
          }

          boundary = buffer.indexOf('\n\n')
        }
      }
    } catch (e) {
      if (abort.signal.aborted) return
      const msg: SseMessage = {
        id: uuidv4(),
        event: 'error',
        data: e instanceof Error ? e.message : String(e),
        timestamp: Date.now()
      }
      conn.messages.push(msg)
      onMessage(id, msg)
    } finally {
      connections.delete(id)
    }
  })()

  return id
}

export function disconnectSse(connectionId: string): void {
  const conn = connections.get(connectionId)
  if (!conn) return
  conn.abort.abort()
  connections.delete(connectionId)
}
