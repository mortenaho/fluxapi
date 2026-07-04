import { JSONPath } from 'jsonpath-plus'

export function parseResponseJson(body: string): { data: unknown; formatted: string } | null {
  const trimmed = body.trim()
  if (!trimmed) return null

  try {
    let data: unknown = JSON.parse(trimmed)
    if (typeof data === 'string') {
      const inner = data.trim()
      if (inner.startsWith('{') || inner.startsWith('[')) {
        try {
          data = JSON.parse(inner)
        } catch {
          /* keep string value */
        }
      }
    }
    return { data, formatted: JSON.stringify(data, null, 2) }
  } catch {
    return null
  }
}

export function normalizeJsonPath(query: string): string {
  const trimmed = query.trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith('$')) return trimmed
  if (trimmed.startsWith('[')) return `$${trimmed}`
  if (trimmed.startsWith('.')) return `$${trimmed}`
  return `$.${trimmed}`
}

function tokenizePath(path: string): string[] {
  const normalized = path.replace(/^\$\.?/, '')
  if (!normalized) return []

  const tokens: string[] = []
  const re = /[^.[\]]+|\[\d+\]/g
  let match: RegExpExecArray | null
  while ((match = re.exec(normalized)) !== null) {
    tokens.push(match[0].replace(/^\[|\]$/g, ''))
  }
  return tokens
}

export function evaluateDotPath(data: unknown, path: string): unknown {
  if (path === '$' || path === '') return data

  const tokens = tokenizePath(path)
  if (tokens.length === 0) return data

  let current: unknown = data
  for (const token of tokens) {
    if (current === null || current === undefined) return undefined

    if (Array.isArray(current)) {
      const index = Number(token)
      if (!Number.isInteger(index)) return undefined
      current = current[index]
      continue
    }

    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[token]
      continue
    }

    return undefined
  }

  return current
}

function isAdvancedJsonPath(path: string): boolean {
  return /(\.\.|\[\s*\*|\[\s*\?|[*?@])/.test(path)
}

export function runJsonPathQuery(
  data: unknown,
  query: string
): { ok: true; result: unknown } | { ok: false; error: string } {
  const trimmed = query.trim()
  if (!trimmed) {
    return { ok: false, error: 'Enter a JSONPath query' }
  }

  const path = normalizeJsonPath(trimmed)

  try {
    if (!isAdvancedJsonPath(path)) {
      const dot = evaluateDotPath(data, path)
      if (dot !== undefined) {
        return { ok: true, result: dot }
      }
    }

    const matches = JSONPath({
      path,
      json: data as object,
      wrap: true
    }) as unknown[]

    if (!Array.isArray(matches) || matches.length === 0) {
      const dot = evaluateDotPath(data, path)
      return { ok: true, result: dot ?? null }
    }

    if (matches.length === 1) {
      return { ok: true, result: matches[0] }
    }

    return { ok: true, result: matches }
  } catch (e) {
    try {
      const dot = evaluateDotPath(data, path)
      if (dot !== undefined) {
        return { ok: true, result: dot }
      }
    } catch {
      /* fall through */
    }
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid JSONPath query' }
  }
}

export function formatQueryResult(result: unknown): string {
  if (result === null || result === undefined) return 'No matches'
  if (Array.isArray(result)) {
    if (result.length === 0) return 'No matches'
    if (result.length === 1) return JSON.stringify(result[0], null, 2)
  }
  return JSON.stringify(result, null, 2)
}

export function formatEnvValue(result: unknown): string {
  if (result === null || result === undefined) return ''
  if (typeof result === 'string') return result
  if (typeof result === 'number' || typeof result === 'boolean') return String(result)
  if (Array.isArray(result)) {
    if (result.length === 0) return ''
    if (result.length === 1) return formatEnvValue(result[0])
    return JSON.stringify(result)
  }
  if (typeof result === 'object') return JSON.stringify(result)
  return String(result)
}

export type ResponseBodyView = {
  language: string
  label: string
  formatted: string
  data: unknown | null
}

export function isHtmlResponse(body: string, contentType = ''): boolean {
  return detectResponseBody(body, contentType).language === 'html'
}

export function detectResponseBody(body: string, contentType = ''): ResponseBodyView {
  const parsed = parseResponseJson(body)
  if (parsed) {
    return { language: 'json', label: 'JSON', formatted: parsed.formatted, data: parsed.data }
  }

  const ct = contentType.toLowerCase()
  const trimmed = body.trim()

  if (ct.includes('html') || /^<!doctype html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    return { language: 'html', label: 'HTML', formatted: body, data: null }
  }
  if (ct.includes('xml') || (trimmed.startsWith('<?xml') || (trimmed.startsWith('<') && trimmed.endsWith('>')))) {
    return { language: 'xml', label: 'XML', formatted: body, data: null }
  }
  if (ct.includes('javascript') || ct.includes('ecmascript')) {
    return { language: 'javascript', label: 'JavaScript', formatted: body, data: null }
  }
  if (ct.includes('css')) {
    return { language: 'css', label: 'CSS', formatted: body, data: null }
  }

  return { language: 'plaintext', label: 'Text', formatted: body, data: null }
}
