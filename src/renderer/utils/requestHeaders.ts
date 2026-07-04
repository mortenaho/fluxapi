import { v4 as uuidv4 } from 'uuid'
import type { KeyValue } from '@shared/types'

export function readContentTypeHeader(headers: KeyValue[]): string | undefined {
  return headers.find((h) => h.enabled && h.key.toLowerCase() === 'content-type')?.value
}

export function upsertContentTypeHeader(headers: KeyValue[], contentType: string | null): KeyValue[] {
  const idx = headers.findIndex((h) => h.key.toLowerCase() === 'content-type')
  if (!contentType?.trim()) {
    return idx >= 0 ? headers.filter((_, i) => i !== idx) : headers
  }

  const row: KeyValue = {
    id: idx >= 0 ? headers[idx].id : uuidv4(),
    key: 'Content-Type',
    value: contentType,
    enabled: true
  }

  if (idx >= 0) return headers.map((h, i) => (i === idx ? row : h))
  return [...headers, row]
}
