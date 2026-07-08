import { decodeBase64 } from './base64'

export function decodeBase64Url(value: string): string {
  let input = value.replace(/-/g, '+').replace(/_/g, '/')
  const pad = input.length % 4
  if (pad) input += '='.repeat(4 - pad)
  return decodeBase64(input)
}

export interface JwtPart {
  raw: string
  json: unknown
}

export interface JwtDecodeResult {
  header: JwtPart
  payload: JwtPart
  signature: string
}

export function decodeJwt(token: string): JwtDecodeResult {
  const parts = token.trim().split('.')
  if (parts.length < 2) {
    throw new Error('Invalid JWT: expected header.payload[.signature]')
  }

  const [headerRaw, payloadRaw, signature = ''] = parts
  const headerJson = JSON.parse(decodeBase64Url(headerRaw))
  const payloadJson = JSON.parse(decodeBase64Url(payloadRaw))

  return {
    header: { raw: headerRaw, json: headerJson },
    payload: { raw: payloadRaw, json: payloadJson },
    signature
  }
}

export function formatJwtJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}
