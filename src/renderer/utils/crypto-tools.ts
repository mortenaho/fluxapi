import { decodeBytesBase64, encodeBytesBase64 } from './base64'

export type CryptoAlgorithmId = 'AES-256-GCM' | 'AES-128-GCM' | 'AES-256-CBC' | 'AES-128-CBC'
export type KeyFormat = 'text' | 'hex' | 'base64'

const IV_LENGTH: Record<CryptoAlgorithmId, number> = {
  'AES-256-GCM': 12,
  'AES-128-GCM': 12,
  'AES-256-CBC': 16,
  'AES-128-CBC': 16
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string): Uint8Array {
  const cleaned = hex.trim().replace(/\s+/g, '')
  if (!/^[0-9a-fA-F]*$/.test(cleaned) || cleaned.length % 2 !== 0) {
    throw new Error('Invalid hex value')
  }
  const bytes = new Uint8Array(cleaned.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

function parseKeyMaterial(key: string, format: KeyFormat): Uint8Array {
  if (format === 'hex') return hexToBytes(key)
  if (format === 'base64') return decodeBytesBase64(key)
  return new TextEncoder().encode(key)
}

function toBuffer(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(bytes)
}

async function importKeyForAlgorithm(
  key: string,
  format: KeyFormat,
  algorithm: CryptoAlgorithmId
): Promise<CryptoKey> {
  const bits = algorithm.startsWith('AES-256') ? 256 : 128
  const material = parseKeyMaterial(key, format)
  let raw: Uint8Array<ArrayBuffer>

  if (format === 'text') {
    const digest = await crypto.subtle.digest('SHA-256', toBuffer(material))
    raw = toBuffer(new Uint8Array(digest).slice(0, bits / 8))
  } else {
    if (material.length !== bits / 8) {
      throw new Error(`Key must be ${bits / 8} bytes for ${algorithm}`)
    }
    raw = toBuffer(material)
  }

  const mode = algorithm.endsWith('GCM') ? 'AES-GCM' : 'AES-CBC'
  return crypto.subtle.importKey('raw', raw, { name: mode }, false, ['encrypt', 'decrypt'])
}

function parseIv(iv: string, format: KeyFormat, expectedLength: number): Uint8Array {
  const bytes =
    format === 'hex'
      ? hexToBytes(iv)
      : format === 'base64'
        ? decodeBytesBase64(iv)
        : new TextEncoder().encode(iv)

  if (bytes.length !== expectedLength) {
    throw new Error(`IV must be ${expectedLength} bytes for this algorithm`)
  }
  return bytes
}

export interface EncryptOptions {
  text: string
  algorithm: CryptoAlgorithmId
  key: string
  keyFormat: KeyFormat
  iv?: string
  ivFormat?: KeyFormat
}

export interface DecryptOptions {
  payload: string
  algorithm: CryptoAlgorithmId
  key: string
  keyFormat: KeyFormat
  iv?: string
  ivFormat?: KeyFormat
}

export async function encryptText(options: EncryptOptions): Promise<{ output: string; iv: string }> {
  const { text, algorithm, key, keyFormat } = options
  const cryptoKey = await importKeyForAlgorithm(key, keyFormat, algorithm)
  const ivLength = IV_LENGTH[algorithm]
  const iv =
    options.iv && options.iv.trim()
      ? toBuffer(parseIv(options.iv, options.ivFormat || 'hex', ivLength))
      : crypto.getRandomValues(new Uint8Array(ivLength))

  const mode = algorithm.endsWith('GCM') ? 'AES-GCM' : 'AES-CBC'
  const encrypted = await crypto.subtle.encrypt(
    { name: mode, iv },
    cryptoKey,
    toBuffer(new TextEncoder().encode(text))
  )

  const cipherBase64 = encodeBytesBase64(new Uint8Array(encrypted))
  const ivBase64 = encodeBytesBase64(iv)
  return {
    output: `${ivBase64}.${cipherBase64}`,
    iv: bytesToHex(iv)
  }
}

export async function decryptText(options: DecryptOptions): Promise<string> {
  const { algorithm, key, keyFormat } = options
  const cryptoKey = await importKeyForAlgorithm(key, keyFormat, algorithm)
  const ivLength = IV_LENGTH[algorithm]

  let iv: Uint8Array
  let cipherBase64: string

  const payload = options.payload.trim()
  if (payload.includes('.')) {
    const [ivPart, cipherPart] = payload.split('.', 2)
    iv = decodeBytesBase64(ivPart)
    cipherBase64 = cipherPart
  } else {
    if (!options.iv?.trim()) throw new Error('IV is required when ciphertext has no embedded IV')
    iv = parseIv(options.iv, options.ivFormat || 'hex', ivLength)
    cipherBase64 = payload
  }

  if (iv.length !== ivLength) {
    throw new Error(`IV must be ${ivLength} bytes for ${algorithm}`)
  }

  const cipherBytes = toBuffer(decodeBytesBase64(cipherBase64))
  const mode = algorithm.endsWith('GCM') ? 'AES-GCM' : 'AES-CBC'
  const decrypted = await crypto.subtle.decrypt({ name: mode, iv: toBuffer(iv) }, cryptoKey, cipherBytes)
  return new TextDecoder().decode(decrypted)
}

export const CRYPTO_ALGORITHMS: { id: CryptoAlgorithmId; label: string }[] = [
  { id: 'AES-256-GCM', label: 'AES-256-GCM' },
  { id: 'AES-128-GCM', label: 'AES-128-GCM' },
  { id: 'AES-256-CBC', label: 'AES-256-CBC' },
  { id: 'AES-128-CBC', label: 'AES-128-CBC' }
]
