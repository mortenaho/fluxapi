import { describe, expect, it, afterAll } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { mergeDataRow, parseRunnerDataFile } from '../src/main/services/runner-data.service'
import { kv } from './helpers'

describe('runner-data.service', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lisek-runner-data-'))

  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('parses CSV rows into environment variable sets', () => {
    const file = join(dir, 'users.csv')
    writeFileSync(file, 'userId,role\n1,admin\n2,guest\n')
    const rows = parseRunnerDataFile(file, 'csv')
    expect(rows).toHaveLength(2)
    expect(rows[0].find((v) => v.key === 'userId')?.value).toBe('1')
    expect(rows[1].find((v) => v.key === 'role')?.value).toBe('guest')
  })

  it('parses JSON array rows', () => {
    const file = join(dir, 'users.json')
    writeFileSync(file, JSON.stringify([{ userId: '9', token: 'abc' }]))
    const rows = parseRunnerDataFile(file, 'json')
    expect(rows[0].find((v) => v.key === 'token')?.value).toBe('abc')
  })

  it('mergeDataRow overrides base environment values', () => {
    const merged = mergeDataRow([kv('userId', '1'), kv('baseUrl', 'http://localhost')], [kv('userId', '2')])
    expect(merged.find((v) => v.key === 'userId')?.value).toBe('2')
    expect(merged.find((v) => v.key === 'baseUrl')?.value).toBe('http://localhost')
  })
})
