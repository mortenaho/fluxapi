import { writeFileSync, readFileSync } from 'fs'
import { v4 as uuidv4 } from 'uuid'
import type { HistoryModel, HttpMethod, KeyValue } from '../../../shared/types'
import { getRequest, listHistory, createCollection, saveRequest, createEmptyRequest } from './repository'

export function exportHarFromHistory(historyId: string, filePath: string): void {
  const entry = listHistory(500).find((h) => h.id === historyId)
  if (!entry) throw new Error('History entry not found')
  writeFileSync(filePath, JSON.stringify(buildHarFromHistory(entry), null, 2), 'utf-8')
}

export function exportHarFromRequest(requestId: string, filePath: string): void {
  const req = getRequest(requestId)
  if (!req?.lastResponse) throw new Error('No response available for this request')
  const started = Date.now() - req.lastResponse.durationMs
  writeFileSync(
    filePath,
    JSON.stringify(
      {
        log: {
          version: '1.2',
          creator: { name: 'Lisek', version: '1.4.0' },
          entries: [
            {
              startedDateTime: new Date(started).toISOString(),
              time: req.lastResponse.durationMs,
              request: {
                method: req.method,
                url: req.url,
                httpVersion: 'HTTP/1.1',
                headers: req.headers
                  .filter((h) => h.enabled && h.key)
                  .map((h) => ({ name: h.key, value: h.value })),
                queryString: req.params
                  .filter((p) => p.enabled && p.key)
                  .map((p) => ({ name: p.key, value: p.value })),
                headersSize: -1,
                bodySize: req.bodyRaw?.length ?? 0,
                postData:
                  req.bodyType === 'raw' && req.bodyRaw
                    ? { mimeType: req.bodyRawContentType, text: req.bodyRaw }
                    : undefined
              },
              response: {
                status: req.lastResponse.statusCode,
                statusText: req.lastResponse.statusText,
                httpVersion: 'HTTP/1.1',
                headers: Object.entries(req.lastResponse.headers).map(([name, value]) => ({ name, value })),
                content: {
                  size: req.lastResponse.sizeBytes,
                  mimeType: req.lastResponse.headers['content-type'] || 'text/plain',
                  text: req.lastResponse.body
                },
                headersSize: -1,
                bodySize: req.lastResponse.sizeBytes
              },
              cache: {},
              timings: { send: 0, wait: req.lastResponse.durationMs, receive: 0 }
            }
          ]
        }
      },
      null,
      2
    ),
    'utf-8'
  )
}

function buildHarFromHistory(entry: HistoryModel) {
  const req = entry.requestSnapshot
  const res = entry.responseSnapshot
  const started = entry.sentAt - res.durationMs

  return {
    log: {
      version: '1.2',
      creator: { name: 'Lisek', version: '1.3.0' },
      entries: [
        {
          startedDateTime: new Date(started).toISOString(),
          time: res.durationMs,
          request: {
            method: req.method,
            url: req.url,
            httpVersion: 'HTTP/1.1',
            headers: req.headers
              .filter((h) => h.enabled && h.key)
              .map((h) => ({ name: h.key, value: h.value })),
            queryString: req.params
              .filter((p) => p.enabled && p.key)
              .map((p) => ({ name: p.key, value: p.value })),
            headersSize: -1,
            bodySize: req.bodyRaw?.length ?? 0,
            postData:
              req.bodyType === 'raw' && req.bodyRaw
                ? { mimeType: req.bodyRawContentType, text: req.bodyRaw }
                : undefined
          },
          response: {
            status: res.statusCode,
            statusText: res.statusText,
            httpVersion: 'HTTP/1.1',
            headers: Object.entries(res.headers).map(([name, value]) => ({ name, value })),
            content: {
              size: res.sizeBytes,
              mimeType: res.headers['content-type'] || 'text/plain',
              text: res.body
            },
            headersSize: -1,
            bodySize: res.sizeBytes
          },
          cache: {},
          timings: { send: 0, wait: res.durationMs, receive: 0 }
        }
      ]
    }
  }
}

type HarEntry = {
  request?: {
    method?: string
    url?: string
    headers?: { name: string; value: string }[]
    queryString?: { name: string; value: string }[]
    postData?: { mimeType?: string; text?: string }
  }
}

export function importHar(
  filePath: string,
  parentCollectionId: string | null = null
): { collectionId: string; count: number } {
  const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as { log?: { entries?: HarEntry[] } }
  const entries = parsed.log?.entries || []
  if (entries.length === 0) throw new Error('No entries found in HAR file')

  const collectionId = parentCollectionId || createCollection({ name: `HAR Import ${new Date().toLocaleDateString()}` }).id
  let count = 0

  for (const [index, entry] of entries.entries()) {
    const req = entry.request
    if (!req?.url) continue
    const headers: KeyValue[] = (req.headers || []).map((h, i) => ({
      id: String(i),
      key: h.name,
      value: h.value,
      enabled: true
    }))
    const params: KeyValue[] = (req.queryString || []).map((p, i) => ({
      id: String(i),
      key: p.name,
      value: p.value,
      enabled: true
    }))
    const bodyRaw = req.postData?.text || ''
    const bodyType = bodyRaw ? 'raw' : 'none'

    saveRequest({
      ...createEmptyRequest(collectionId),
      name: `${req.method || 'GET'} ${truncateUrl(req.url)}`,
      method: (req.method || 'GET').toUpperCase() as HttpMethod,
      url: req.url,
      headers,
      params,
      bodyType,
      bodyRaw,
      bodyRawContentType: req.postData?.mimeType || 'application/json',
      sortOrder: index
    })
    count++
  }

  return { collectionId, count }
}

function truncateUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname.length > 40 ? `${u.pathname.slice(0, 37)}…` : u.pathname
  } catch {
    return url.length > 40 ? `${url.slice(0, 37)}…` : url
  }
}
