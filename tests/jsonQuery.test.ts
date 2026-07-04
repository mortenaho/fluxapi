import { describe, it, expect } from 'vitest'
import {
  parseResponseJson,
  normalizeJsonPath,
  evaluateDotPath,
  runJsonPathQuery,
  formatQueryResult,
  detectResponseBody,
  isHtmlResponse,
  formatEnvValue
} from '../src/renderer/utils/jsonQuery'

const sampleData = {
  data: {
    items: [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }],
    total: 2
  },
  status: 'ok'
}

describe('JSON query utilities', () => {
  it('parseResponseJson — parses valid JSON', () => {
    const result = parseResponseJson('{"a":1}')
    expect(result?.data).toEqual({ a: 1 })
    expect(result?.formatted).toContain('"a": 1')
  })

  it('parseResponseJson — returns null for invalid JSON', () => {
    expect(parseResponseJson('{invalid')).toBeNull()
  })

  it('parseResponseJson — returns null for empty body', () => {
    expect(parseResponseJson('   ')).toBeNull()
  })

  it('normalizeJsonPath — adds $ prefix', () => {
    expect(normalizeJsonPath('data.items')).toBe('$.data.items')
    expect(normalizeJsonPath('$.data')).toBe('$.data')
    expect(normalizeJsonPath('[0]')).toBe('$[0]')
  })

  it('evaluateDotPath — reads nested properties', () => {
    expect(evaluateDotPath(sampleData, '$.data.total')).toBe(2)
    expect(evaluateDotPath(sampleData, '$.data.items[0].name')).toBe('Alpha')
  })

  it('runJsonPathQuery — dot path query', () => {
    const result = runJsonPathQuery(sampleData, 'status')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.result).toBe('ok')
  })

  it('runJsonPathQuery — array index query', () => {
    const result = runJsonPathQuery(sampleData, 'data.items[1].name')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.result).toBe('Beta')
  })

  it('runJsonPathQuery — JSONPath wildcard', () => {
    const result = runJsonPathQuery(sampleData, 'data.items[*].id')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.result).toEqual([1, 2])
  })

  it('runJsonPathQuery — empty query returns error', () => {
    const result = runJsonPathQuery(sampleData, '   ')
    expect(result.ok).toBe(false)
  })

  it('formatQueryResult — formats arrays and null', () => {
    expect(formatQueryResult(null)).toBe('No matches')
    expect(formatQueryResult([42])).toBe('42')
    expect(formatQueryResult({ x: 1 })).toContain('"x": 1')
  })

  it('detectResponseBody — detects JSON and HTML', () => {
    expect(detectResponseBody('{"ok":true}').label).toBe('JSON')
    expect(detectResponseBody('<html><body>Hi</body></html>', 'text/html').language).toBe('html')
    expect(detectResponseBody('plain text').label).toBe('Text')
  })

  it('isHtmlResponse — true for HTML content', () => {
    expect(isHtmlResponse('<html><body>Hi</body></html>', 'text/html')).toBe(true)
    expect(isHtmlResponse('{"ok":true}')).toBe(false)
  })

  it('formatEnvValue — stores plain strings without JSON quotes', () => {
    expect(formatEnvValue('ok')).toBe('ok')
    expect(formatEnvValue(42)).toBe('42')
    expect(formatEnvValue({ x: 1 })).toBe('{"x":1}')
  })
})
