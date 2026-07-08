import { describe, expect, it } from 'vitest'
import { decodeJwt } from '../src/renderer/utils/jwt-tools'
import { hashText } from '../src/renderer/utils/hash-tools'
import { decodeUrl, encodeUrl } from '../src/renderer/utils/hash-tools'

describe('jwt-tools', () => {
  it('decodes JWT header and payload', () => {
    const token =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.signature'
    const decoded = decodeJwt(token)
    expect(decoded.header.json).toEqual({ alg: 'HS256', typ: 'JWT' })
    expect(decoded.payload.json).toEqual({ sub: '1234567890', name: 'John' })
    expect(decoded.signature).toBe('signature')
  })
})

describe('hash-tools', () => {
  it('hashes text with SHA-256 hex output', async () => {
    const hash = await hashText('hello', 'SHA-256', 'hex')
    expect(hash).toHaveLength(64)
  })

  it('encodes and decodes URL components', () => {
    const encoded = encodeUrl('a b+c', true)
    expect(decodeUrl(encoded, true)).toBe('a b+c')
  })
})
