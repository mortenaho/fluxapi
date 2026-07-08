import { describe, expect, it } from 'vitest'
import { decodeBase64, encodeBase64 } from '../src/renderer/utils/base64'

describe('base64 utils', () => {
  it('encodes and decodes UTF-8 text', () => {
    const text = 'سلام Lisek 🦊'
    expect(decodeBase64(encodeBase64(text))).toBe(text)
  })

  it('supports URL-safe encoding', () => {
    const encoded = encodeBase64('a+b/c', true)
    expect(encoded).not.toContain('+')
    expect(encoded).not.toContain('/')
    expect(decodeBase64(encoded, true)).toBe('a+b/c')
  })
})
