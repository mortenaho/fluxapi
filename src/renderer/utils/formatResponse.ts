import type { HttpResponse } from '@shared/types'

export function formatFullResponseText(response: HttpResponse): string {
  const headerLines = Object.entries(response.headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')

  const cookieLines = response.cookies
    .map((cookie) => (cookie.value ? `${cookie.key}=${cookie.value}` : cookie.key))
    .join('\n')

  const sections = [
    `Status: ${response.statusCode} ${response.statusText}`,
    `Duration: ${response.durationMs} ms`,
    `Size: ${response.sizeBytes.toLocaleString()} B`,
    '',
    '--- Headers ---',
    headerLines || '(none)'
  ]

  if (response.cookies.length > 0) {
    sections.push('', '--- Cookies ---', cookieLines)
  }

  sections.push('', '--- Body ---', response.body)
  return sections.join('\n')
}

export function serializeFullResponse(response: HttpResponse): string {
  return JSON.stringify(response, null, 2)
}

export function defaultResponseDownloadName(response: HttpResponse): string {
  return `response-${response.statusCode}.json`
}

export function suggestedBinaryDownloadName(response: HttpResponse): string {
  const disposition =
    response.headers['content-disposition'] || response.headers['Content-Disposition'] || ''
  const quoted = disposition.match(/filename="([^"]+)"/i)
  if (quoted?.[1]) return quoted[1]
  const plain = disposition.match(/filename=([^;]+)/i)
  if (plain?.[1]) return plain[1].trim()

  const contentType = (
    response.headers['content-type'] ||
    response.headers['Content-Type'] ||
    ''
  ).toLowerCase()

  if (contentType.includes('pdf')) return `response-${response.statusCode}.pdf`
  if (contentType.includes('png')) return `response-${response.statusCode}.png`
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return `response-${response.statusCode}.jpg`
  if (contentType.includes('gif')) return `response-${response.statusCode}.gif`
  if (contentType.includes('webp')) return `response-${response.statusCode}.webp`
  if (contentType.includes('json')) return `response-${response.statusCode}.json`
  if (contentType.includes('html')) return `response-${response.statusCode}.html`
  if (contentType.includes('text')) return `response-${response.statusCode}.txt`
  return `response-${response.statusCode}.bin`
}
