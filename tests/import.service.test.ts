import { describe, it, expect, afterAll } from 'vitest'
import { detectImportFormat } from '../src/main/services/fetch-import.service'
import { importInsomniaFromContent, importPostmanFromContent } from '../src/main/services/import.service'
import { initDatabase } from '../src/main/db/index'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('detectImportFormat', () => {
  it('detects yaml from URL extension', () => {
    expect(detectImportFormat('https://api.example.com/openapi.yaml', null, '')).toBe('yaml')
  })

  it('detects json from content', () => {
    expect(detectImportFormat('https://api.example.com/spec', null, '{"openapi":"3.0.0"}')).toBe('json')
  })

  it('detects yaml from content prefix', () => {
    expect(detectImportFormat('https://api.example.com/spec', null, 'openapi: 3.0.0\ninfo:\n  title: API')).toBe(
      'yaml'
    )
  })
})

describe('importInsomniaFromContent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fluxapi-import-'))
  initDatabase(join(dir, 'test.db'))

  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('imports insomnia workspace with requests', () => {
    const content = JSON.stringify({
      __export_format: 4,
      resources: [
        { _type: 'workspace', _id: 'wrk_1', name: 'Demo Workspace' },
        { _type: 'request_group', _id: 'fld_1', parentId: 'wrk_1', name: 'Users' },
        {
          _type: 'request',
          _id: 'req_1',
          parentId: 'fld_1',
          name: 'List Users',
          method: 'GET',
          url: 'https://api.example.com/users'
        }
      ]
    })

    const result = importInsomniaFromContent(content, 'demo.json')
    expect(result.count).toBe(1)
    expect(result.collectionId).toBeTruthy()
  })

  it('rejects postman collection for insomnia import', () => {
    const content = JSON.stringify({
      info: { schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
      item: []
    })

    expect(() => importInsomniaFromContent(content, 'postman.json')).toThrow(/Insomnia/i)
  })
})

describe('importPostmanFromContent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fluxapi-postman-'))
  initDatabase(join(dir, 'test.db'))

  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('rejects insomnia export for postman import', () => {
    const content = JSON.stringify({
      __export_format: 4,
      resources: [{ _type: 'workspace', _id: 'wrk_1', name: 'Demo' }]
    })

    expect(() => importPostmanFromContent(content, 'insomnia.json')).toThrow(/Insomnia/i)
  })
})
