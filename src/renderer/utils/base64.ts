export function encodeBytesBase64(bytes: Uint8Array, urlSafe = false): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  let encoded = btoa(binary)
  if (urlSafe) {
    encoded = encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  }
  return encoded
}

export function decodeBytesBase64(encoded: string, urlSafe = false): Uint8Array {
  let input = encoded.trim()
  if (!input) return new Uint8Array()

  if (urlSafe) {
    input = input.replace(/-/g, '+').replace(/_/g, '/')
    const pad = input.length % 4
    if (pad) input += '='.repeat(4 - pad)
  }

  const binary = atob(input)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

export function encodeBase64(text: string, urlSafe = false): string {
  return encodeBytesBase64(new TextEncoder().encode(text), urlSafe)
}

export function decodeBase64(encoded: string, urlSafe = false): string {
  return new TextDecoder().decode(decodeBytesBase64(encoded, urlSafe))
}
