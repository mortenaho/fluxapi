import { Agent, fetch as undiciFetch } from 'undici'
import { getSettings } from '../db'

export type ImportFormatHint = 'json' | 'yaml' | 'unknown'

export interface FetchedImportSource {
  content: string
  sourceLabel: string
  formatHint: ImportFormatHint
}

function labelFromUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const segment = parsed.pathname.split('/').filter(Boolean).pop()
    return segment || parsed.hostname || url
  } catch {
    return url
  }
}

export function detectImportFormat(
  url: string,
  contentType: string | null,
  content: string
): ImportFormatHint {
  const lowerUrl = url.toLowerCase()
  const lowerType = (contentType || '').toLowerCase()

  if (
    lowerUrl.endsWith('.yaml') ||
    lowerUrl.endsWith('.yml') ||
    lowerType.includes('yaml') ||
    lowerType.includes('x-yaml')
  ) {
    return 'yaml'
  }

  if (lowerUrl.endsWith('.json') || lowerType.includes('json')) {
    return 'json'
  }

  const trimmed = content.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json'
  if (/^(openapi|swagger|info|paths):/m.test(trimmed)) return 'yaml'

  return 'unknown'
}

export async function fetchImportSource(url: string): Promise<FetchedImportSource> {
  const trimmed = url.trim()
  if (!trimmed) throw new Error('URL is required')

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error('Invalid URL')
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http and https URLs are supported')
  }

  const settings = getSettings()
  const init: RequestInit = {
    method: 'GET',
    headers: {
      Accept: 'application/json, application/yaml, text/yaml, text/plain, */*'
    },
    redirect: settings.followRedirects ? 'follow' : 'manual'
  }

  let response: Response
  if (settings.sslVerify === false) {
    const agent = new Agent({ connect: { rejectUnauthorized: false } })
    response = (await undiciFetch(trimmed, {
      ...init,
      dispatcher: agent
    } as never)) as unknown as Response
  } else {
    response = await fetch(trimmed, init)
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch URL (${response.status} ${response.statusText})`)
  }

  const content = await response.text()
  if (!content.trim()) throw new Error('URL returned an empty response')

  return {
    content,
    sourceLabel: labelFromUrl(trimmed),
    formatHint: detectImportFormat(trimmed, response.headers.get('content-type'), content)
  }
}
