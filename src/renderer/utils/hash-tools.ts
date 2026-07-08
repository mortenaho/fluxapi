export type HashAlgorithm = 'SHA-256' | 'SHA-384' | 'SHA-512'
export type HashOutputFormat = 'hex' | 'base64'

export const HASH_ALGORITHMS: { id: HashAlgorithm; label: string }[] = [
  { id: 'SHA-256', label: 'SHA-256' },
  { id: 'SHA-384', label: 'SHA-384' },
  { id: 'SHA-512', label: 'SHA-512' }
]

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export async function hashText(
  text: string,
  algorithm: HashAlgorithm,
  format: HashOutputFormat = 'hex'
): Promise<string> {
  const digest = await crypto.subtle.digest(algorithm, new TextEncoder().encode(text))
  const bytes = new Uint8Array(digest)
  return format === 'hex' ? bytesToHex(bytes) : bytesToBase64(bytes)
}

export function encodeUrl(text: string, componentOnly = true): string {
  return componentOnly ? encodeURIComponent(text) : encodeURI(text)
}

export function decodeUrl(text: string, componentOnly = true): string {
  return componentOnly ? decodeURIComponent(text) : decodeURI(text)
}
