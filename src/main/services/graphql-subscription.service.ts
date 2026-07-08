import WebSocket from 'ws'
import type { KeyValue, WsMessage } from '../../../shared/types'
import { v4 as uuidv4 } from 'uuid'

interface SubscriptionConnection {
  ws: WebSocket
  messages: WsMessage[]
}

const subscriptions = new Map<string, SubscriptionConnection>()

function httpToWs(url: string): string {
  if (url.startsWith('ws://') || url.startsWith('wss://')) return url
  if (url.startsWith('https://')) return `wss://${url.slice('https://'.length)}`
  if (url.startsWith('http://')) return `ws://${url.slice('http://'.length)}`
  return url
}

function buildHeaders(headers: KeyValue[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const h of headers) {
    if (h.enabled && h.key) map[h.key] = h.value
  }
  return map
}

export function connectGraphQLSubscription(
  url: string,
  query: string,
  variables: string,
  headers: KeyValue[],
  onMessage: (connectionId: string, message: WsMessage) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const id = uuidv4()
    const wsUrl = httpToWs(url)
    const ws = new WebSocket(wsUrl, 'graphql-transport-ws', { headers: buildHeaders(headers) })
    const conn: SubscriptionConnection = { ws, messages: [] }
    subscriptions.set(id, conn)

    let parsedVars: unknown = {}
    try {
      parsedVars = JSON.parse(variables || '{}')
    } catch {
      parsedVars = {}
    }

    const operationId = uuidv4()

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'connection_init', payload: {} }))
      ws.send(
        JSON.stringify({
          type: 'subscribe',
          id: operationId,
          payload: { query, variables: parsedVars }
        })
      )
      resolve(id)
    })

    ws.on('message', (raw) => {
      const text = raw.toString()
      let payload: { type?: string } = {}
      try {
        payload = JSON.parse(text)
      } catch {
        payload = {}
      }

      if (payload.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }))
        return
      }

      const msg: WsMessage = {
        id: uuidv4(),
        direction: 'received',
        data: text,
        timestamp: Date.now()
      }
      conn.messages.push(msg)
      onMessage(id, msg)
    })

    ws.on('error', (err) => {
      subscriptions.delete(id)
      reject(err)
    })

    ws.on('close', () => subscriptions.delete(id))
  })
}

export function disconnectGraphQLSubscription(connectionId: string): void {
  const conn = subscriptions.get(connectionId)
  if (!conn) return
  conn.ws.close()
  subscriptions.delete(connectionId)
}
