import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { importHar } from '../src/main/services/har.service'
import { initDatabase } from '../src/main/db/index'
import { listRequests } from '../src/main/services/repository'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('har import', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lisek-har-import-'))

  beforeAll(async () => {
    await initDatabase(join(dir, 'test.db'))
  })

  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('imports requests from a HAR file', () => {
    const harPath = join(dir, 'sample.har')
    writeFileSync(
      harPath,
      JSON.stringify({
        log: {
          version: '1.2',
          entries: [
            {
              request: {
                method: 'GET',
                url: 'https://example.com/api/users',
                headers: [{ name: 'Accept', value: 'application/json' }],
                queryString: []
              }
            }
          ]
        }
      })
    )

    const result = importHar(harPath)
    expect(result.count).toBe(1)
    expect(listRequests().some((r) => r.url === 'https://example.com/api/users')).toBe(true)
  })
})
