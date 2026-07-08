import { readFileSync } from 'fs'
import { v4 as uuidv4 } from 'uuid'
import type { KeyValue } from '../../../shared/types'

export type DataFileFormat = 'csv' | 'json'

export function detectDataFileFormat(filePath: string): DataFileFormat {
  return filePath.toLowerCase().endsWith('.json') ? 'json' : 'csv'
}

export function parseRunnerDataFile(filePath: string, format?: DataFileFormat): KeyValue[][] {
  const fmt = format ?? detectDataFileFormat(filePath)
  const content = readFileSync(filePath, 'utf-8').trim()
  if (!content) return []

  if (fmt === 'json') {
    const parsed = JSON.parse(content) as unknown
    const rows = Array.isArray(parsed) ? parsed : [parsed]
    return rows.map((row) => objectToKeyValues(row as Record<string, unknown>))
  }

  const lines = content.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) return []
  const headers = parseCsvLine(lines[0])
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    return headers.map((key, index) => ({
      id: uuidv4(),
      key,
      value: values[index] ?? '',
      enabled: true
    }))
  })
}

function objectToKeyValues(row: Record<string, unknown>): KeyValue[] {
  return Object.entries(row).map(([key, value]) => ({
    id: uuidv4(),
    key,
    value: value === null || value === undefined ? '' : String(value),
    enabled: true
  }))
}

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      values.push(current)
      current = ''
      continue
    }
    current += ch
  }
  values.push(current)
  return values.map((v) => v.trim())
}

export function mergeDataRow(base: KeyValue[], row: KeyValue[]): KeyValue[] {
  const map = new Map<string, KeyValue>()
  for (const item of base) {
    if (item.key) map.set(item.key, { ...item })
  }
  for (const item of row) {
    if (item.key) map.set(item.key, { ...item, id: item.id || uuidv4(), enabled: true })
  }
  return Array.from(map.values())
}
