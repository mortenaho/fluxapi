import { describe, it, expect } from 'vitest'
import { runScript } from '../src/main/services/script.service'
import type { HttpRequestPayload, HttpResponse } from '@shared/types'
import { kv } from './helpers'

function baseContext(overrides: Partial<{ response: HttpResponse }> = {}) {
  const request: HttpRequestPayload = {
    method: 'GET',
    url: 'https://api.example.com',
    headers: [kv('Accept', 'application/json')],
    params: [],
    bodyType: 'none',
    bodyRaw: '',
    bodyRawContentType: 'application/json',
    formData: [],
    urlEncoded: [],
    authType: 'none',
    auth: {}
  }
  return {
    request,
    environmentVars: [kv('token', 'old')],
    collectionVars: [kv('region', 'eu')],
    response: overrides.response
  }
}

describe('Script runner service', () => {
  it('runScript — empty script returns unchanged context', () => {
    const result = runScript('', baseContext(), 'prerequest')
    expect(result.testResults).toHaveLength(0)
    expect(result.environmentChanges).toHaveLength(1)
  })

  it('runScript — pre-request sets environment variable', () => {
    const script = `pm.environment.set('token', 'new-token');`
    const result = runScript(script, baseContext(), 'prerequest')
    const token = result.environmentChanges.find((v) => v.key === 'token')
    expect(token?.value).toBe('new-token')
  })

  it('runScript — pre-request sets collection variable', () => {
    const script = `pm.collectionVariables.set('region', 'us');`
    const result = runScript(script, baseContext(), 'prerequest')
    const region = result.collectionChanges.find((v) => v.key === 'region')
    expect(region?.value).toBe('us')
  })

  it('runScript — test script passes assertion', () => {
    const response: HttpResponse = {
      statusCode: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: '{"ok":true}',
      durationMs: 10,
      sizeBytes: 12,
      cookies: []
    }
    const script = `
      pm.test('status is 200', function() {
        pm.expect(pm.response.code).to.equal(200);
      });
    `
    const result = runScript(script, baseContext({ response }), 'test')
    expect(result.testResults).toHaveLength(1)
    expect(result.testResults[0].passed).toBe(true)
  })

  it('runScript — test script fails assertion', () => {
    const response: HttpResponse = {
      statusCode: 404,
      statusText: 'Not Found',
      headers: {},
      body: '',
      durationMs: 5,
      sizeBytes: 0,
      cookies: []
    }
    const script = `
      pm.test('status is 200', function() {
        pm.expect(pm.response.code).to.equal(200);
      });
    `
    const result = runScript(script, baseContext({ response }), 'test')
    expect(result.testResults[0].passed).toBe(false)
    expect(result.testResults[0].error).toContain('Expected 200')
  })

  it('runScript — pm.response.json() parses body', () => {
    const response: HttpResponse = {
      statusCode: 200,
      statusText: 'OK',
      headers: {},
      body: '{"count":3}',
      durationMs: 1,
      sizeBytes: 10,
      cookies: []
    }
    const script = `
      pm.test('json count', function() {
        const body = pm.response.json();
        pm.expect(body.count).to.equal(3);
      });
    `
    const result = runScript(script, baseContext({ response }), 'test')
    expect(result.testResults[0].passed).toBe(true)
  })

  it('runScript — console.log captured', () => {
    const script = `console.log('hello', 'world');`
    const result = runScript(script, baseContext(), 'prerequest')
    expect(result.console.join(' ')).toContain('hello world')
  })

  it('runScript — alert calls host callback', () => {
    const alerts: string[] = []
    runScript(`alert('hello');`, baseContext(), 'prerequest', {
      alert: (msg) => alerts.push(msg)
    })
    expect(alerts).toEqual(['hello'])
  })

  it('runScript — pre-request script error is reported', () => {
    const result = runScript(`throw new Error('boom');`, baseContext(), 'prerequest')
    expect(result.testResults).toHaveLength(1)
    expect(result.testResults[0].passed).toBe(false)
    expect(result.testResults[0].error).toContain('boom')
  })

  it('runScript — pm.request.url can be changed', () => {
    const result = runScript(`pm.request.url = 'https://changed.example.com';`, baseContext(), 'prerequest')
    expect(result.requestChanges.url).toBe('https://changed.example.com')
  })
})
