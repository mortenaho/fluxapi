import { describe, expect, it, afterEach } from 'vitest'
import {
  addMockRoute,
  clearMockRoutes,
  ensureMockRoute,
  normalizeMockPath,
  seedDefaultRouteIfEmpty,
  startMockServer,
  stopMockServer,
  updateMockRoute
} from '../src/main/services/mock-server.service'

describe('mock-server.service', () => {
  afterEach(async () => {
    await stopMockServer()
    clearMockRoutes()
  })

  it('starts server and matches routes', async () => {
    addMockRoute({
      method: 'GET',
      path: '/api/hello',
      statusCode: 200,
      body: '{"ok":true}',
      headers: {}
    })
    const state = await startMockServer(0)
    expect(state.running).toBe(true)
    expect(state.port).toBeGreaterThan(0)

    const res = await fetch(`${state.baseUrl}/api/hello`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('{"ok":true}')
  })

  it('normalizes path without leading slash', async () => {
    addMockRoute({
      method: 'GET',
      path: 'api/hello',
      statusCode: 200,
      body: 'hi',
      headers: {}
    })
    const state = await startMockServer(0)
    const res = await fetch(`${state.baseUrl}/api/hello`)
    expect(res.status).toBe(200)
  })

  it('matches trailing slash in request path', async () => {
    addMockRoute({
      method: 'GET',
      path: '/api/hello',
      statusCode: 200,
      body: 'hi',
      headers: {}
    })
    const state = await startMockServer(0)
    const res = await fetch(`${state.baseUrl}/api/hello/`)
    expect(res.status).toBe(200)
  })

  it('extracts pathname when full URL is stored as route path', async () => {
    addMockRoute({
      method: 'GET',
      path: 'http://127.0.0.1:4010/api/hello',
      statusCode: 200,
      body: 'hi',
      headers: {}
    })
    const state = await startMockServer(0)
    const res = await fetch(`${state.baseUrl}/api/hello`)
    expect(res.status).toBe(200)
  })

  it('returns 404 when no route matches', async () => {
    const state = await startMockServer(0)
    const res = await fetch(`${state.baseUrl}/missing`)
    expect(res.status).toBe(404)
  })

  it('responds when requested via localhost hostname', async () => {
    addMockRoute({
      method: 'GET',
      path: '/api/hello',
      statusCode: 200,
      body: 'ok',
      headers: {}
    })
    const state = await startMockServer(0)
    const res = await fetch(`http://localhost:${state.port}/api/hello`)
    expect(res.status).toBe(200)
  })

  it('handles OPTIONS preflight', async () => {
    addMockRoute({
      method: 'POST',
      path: '/api/hello',
      statusCode: 200,
      body: '{}',
      headers: {}
    })
    const state = await startMockServer(0)
    const res = await fetch(`${state.baseUrl}/api/hello`, { method: 'OPTIONS' })
    expect(res.status).toBe(204)
  })

  it('seeds default route when store is empty', async () => {
    const state = seedDefaultRouteIfEmpty({
      method: 'GET',
      path: '/api/hello',
      statusCode: 200,
      body: '{"ok":true}',
      headers: {}
    })
    expect(state.routes).toHaveLength(1)
  })

  it('ensures route exists before serving', async () => {
    ensureMockRoute({
      method: 'GET',
      path: '/api/hello',
      statusCode: 200,
      body: '{"ok":true}',
      headers: {}
    })
    const state = await startMockServer(0)
    const res = await fetch(`${state.baseUrl}/api/hello`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('{"ok":true}')
  })

  it('updates an existing route', async () => {
    const created = addMockRoute({
      method: 'GET',
      path: '/api/hello',
      statusCode: 200,
      body: '{"ok":true}',
      headers: {}
    })
    const id = created.routes[0].id
    const updated = updateMockRoute(id, {
      method: 'GET',
      path: '/api/hello',
      statusCode: 201,
      body: '{"updated":true}',
      headers: {}
    })
    expect(updated.routes[0].statusCode).toBe(201)
    expect(updated.routes[0].body).toBe('{"updated":true}')
  })

  it('exposes health endpoint', async () => {
    addMockRoute({
      method: 'GET',
      path: '/api/hello',
      statusCode: 200,
      body: 'ok',
      headers: {}
    })
    const state = await startMockServer(0)
    const res = await fetch(`${state.baseUrl}/__lisek/mock/health`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.lisekMock).toBe(true)
    expect(body.routes).toBeGreaterThan(0)
  })
})

describe('normalizeMockPath', () => {
  it('normalizes relative and absolute paths', () => {
    expect(normalizeMockPath('api/hello')).toBe('/api/hello')
    expect(normalizeMockPath('/api/hello/')).toBe('/api/hello')
    expect(normalizeMockPath('http://127.0.0.1:4010/api/hello')).toBe('/api/hello')
  })
})
