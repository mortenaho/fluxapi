import { describe, expect, it } from 'vitest'
import { decryptText, encryptText } from '../src/renderer/utils/crypto-tools'

describe('crypto-tools', () => {
  it('encrypts and decrypts with AES-256-GCM using text key', async () => {
    const plain = 'secret payload'
    const encrypted = await encryptText({
      text: plain,
      algorithm: 'AES-256-GCM',
      key: 'my-secret-key',
      keyFormat: 'text'
    })

    expect(encrypted.output).toContain('.')
    const decrypted = await decryptText({
      payload: encrypted.output,
      algorithm: 'AES-256-GCM',
      key: 'my-secret-key',
      keyFormat: 'text'
    })
    expect(decrypted).toBe(plain)
  })

  it('encrypts and decrypts with AES-128-CBC using hex key', async () => {
    const keyHex = '00112233445566778899aabbccddeeff'
    const ivHex = '0102030405060708090a0b0c0d0e0f10'
    const encrypted = await encryptText({
      text: 'cbc test',
      algorithm: 'AES-128-CBC',
      key: keyHex,
      keyFormat: 'hex',
      iv: ivHex,
      ivFormat: 'hex'
    })

    const decrypted = await decryptText({
      payload: encrypted.output,
      algorithm: 'AES-128-CBC',
      key: keyHex,
      keyFormat: 'hex'
    })
    expect(decrypted).toBe('cbc test')
  })
})
