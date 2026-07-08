import http from 'http'
import net from 'net'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import type { MockRoute, MockServerState } from '../../../shared/types'

const HEALTH_PATH = '/__lisek/mock/health'
const DEFAULT_PORT = 4010

interface MockStore {
  routes: Map<string, MockRoute>
  server: http.Server | null
  servers: http.Server[]
  port: number
  routesLoaded: boolean
}

const GLOBAL_KEY = '__lisekMockServerStore'

function routesFilePath(): string {
  return join(app.getPath('userData'), 'mock-routes.json')
}

function loadPersistedRoutes(): MockRoute[] {
  try {
    if (!app.isReady()) return []
    const filePath = routesFilePath()
    if (!existsSync(filePath)) return []
    const parsed = JSON.parse(readFileSync(filePath, 'utf8'))
    return Array.isArray(parsed) ? (parsed as MockRoute[]) : []
  } catch {
    return []
  }
}

function persistRoutes(routes: Map<string, MockRoute>): void {
  try {
    if (!app.isReady()) return
    writeFileSync(routesFilePath(), JSON.stringify(Array.from(routes.values()), null, 2), 'utf8')
  } catch {
    // ignore persistence errors
  }
}

function ensureRoutesLoaded(store: MockStore): void {
  if (store.routesLoaded) return
  store.routesLoaded = true
  for (const route of loadPersistedRoutes()) {
    if (!route?.id || !route.path) continue
    store.routes.set(route.id, {
      ...route,
      method: route.method.trim().toUpperCase() || 'GET',
      path: normalizeMockPath(route.path)
    })
  }
}

function getStore(): MockStore {
  const g = globalThis as typeof globalThis & { [GLOBAL_KEY]?: MockStore }
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = { routes: new Map(), server: null, servers: [], port: 0, routesLoaded: false }
  }
  ensureRoutesLoaded(g[GLOBAL_KEY])
  return g[GLOBAL_KEY]
}

function corsHeaders(): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD',
    'access-control-allow-headers': '*'
  }
}

export function normalizeMockPath(path: string): string {
  const trimmed = path.trim()
  if (!trimmed || trimmed === '*') return trimmed === '*' ? '*' : '/'

  let pathname = trimmed
  if (trimmed.includes('://')) {
    try {
      pathname = new URL(trimmed).pathname
    } catch {
      pathname = trimmed
    }
  }

  const withoutQuery = pathname.split('?')[0]
  const withSlash = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`
  const normalized = withSlash.replace(/\/+$/, '')
  return normalized || '/'
}

function buildState(store: MockStore): MockServerState {
  return {
    running: store.server !== null,
    port: store.port,
    baseUrl: store.server ? `http://127.0.0.1:${store.port}` : '',
    routes: Array.from(store.routes.values())
  }
}

function matchRoute(store: MockStore, method: string, pathname: string): MockRoute | null {
  const normalizedMethod = method.toUpperCase()
  const normalizedPath = normalizeMockPath(pathname)

  for (const route of store.routes.values()) {
    const routePath = normalizeMockPath(route.path)
    const routeMethod = route.method.toUpperCase()
    if (routeMethod !== normalizedMethod && routeMethod !== 'ANY' && routeMethod !== '*') continue
    if (routePath === '*' || routePath === normalizedPath) return route
  }
  return null
}

function createRequestHandler() {
  return (req: http.IncomingMessage, res: http.ServerResponse) => {
    const store = getStore()

    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders())
      res.end()
      return
    }

    const url = new URL(req.url || '/', `http://127.0.0.1:${store.port || 80}`)

    if (url.pathname === HEALTH_PATH) {
      res.writeHead(200, { 'content-type': 'application/json', ...corsHeaders() })
      res.end(
        JSON.stringify({
          ok: true,
          lisekMock: true,
          pid: process.pid,
          routes: store.routes.size,
          routeList: Array.from(store.routes.values()).map((r) => `${r.method} ${r.path}`)
        })
      )
      return
    }

    const route = matchRoute(store, req.method || 'GET', url.pathname)
    if (!route) {
      const available = Array.from(store.routes.values()).map((r) => `${r.method} ${r.path}`)
      res.writeHead(404, { 'content-type': 'application/json', ...corsHeaders() })
      res.end(
        JSON.stringify({
          error: 'No mock route matched',
          method: req.method,
          path: url.pathname,
          configuredRoutes: available,
          hint:
            available.length === 0
              ? 'Open Mock Server in Lisek, click Start, then retry.'
              : `Try one of: ${available.join(', ')}`
        })
      )
      return
    }

    const headers = { ...corsHeaders(), ...route.headers }
    if (!headers['content-type']) {
      headers['content-type'] = 'application/json'
    }
    res.writeHead(route.statusCode, headers)
    res.end(route.body)
  }
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve())
  })
}

async function closeAllServers(store: MockStore): Promise<void> {
  const tracked = [...store.servers]
  if (store.server && !tracked.includes(store.server)) {
    tracked.push(store.server)
  }

  store.servers = []
  store.server = null
  store.port = 0

  await Promise.all(tracked.map((server) => closeServer(server)))
}

function isPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port })
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => resolve(false))
    socket.setTimeout(400, () => {
      socket.destroy()
      resolve(false)
    })
  })
}

async function probeHealth(port: number): Promise<{ ok: boolean; lisekMock?: boolean }> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}${HEALTH_PATH}`, { signal: AbortSignal.timeout(800) })
    if (!res.ok) return { ok: false }
    const body = (await res.json()) as { lisekMock?: boolean }
    return { ok: true, lisekMock: body.lisekMock === true }
  } catch {
    return { ok: false }
  }
}

async function listenOnPort(port: number): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const nextServer = http.createServer(createRequestHandler())
    nextServer.once('error', (err: NodeJS.ErrnoException) => {
      void closeServer(nextServer)
      reject(err)
    })
    nextServer.listen(port, '127.0.0.1', () => resolve(nextServer))
  })
}

async function verifyRunningServer(baseUrl: string, expectedPath: string): Promise<void> {
  const health = await fetch(`${baseUrl}${HEALTH_PATH}`, { signal: AbortSignal.timeout(1500) })
  if (!health.ok) {
    throw new Error('Mock server started but health check failed. Fully quit and reopen Lisek, then Start again.')
  }

  const healthBody = (await health.json()) as { lisekMock?: boolean; routes?: number }
  if (healthBody.lisekMock !== true) {
    throw new Error('Port is used by another app. Pick a different port or close the other listener.')
  }
  if ((healthBody.routes ?? 0) === 0) {
    throw new Error('Mock server has no routes configured.')
  }

  const routePath = normalizeMockPath(expectedPath)
  const res = await fetch(`${baseUrl}${routePath}`, { signal: AbortSignal.timeout(1500) })
  if (!res.ok) {
    throw new Error(`Mock route check failed for GET ${routePath} (HTTP ${res.status}).`)
  }
}

export function getMockServerState(): MockServerState {
  return buildState(getStore())
}

export async function startMockServer(requestedPort: number = DEFAULT_PORT): Promise<MockServerState> {
  const store = getStore()
  const port = requestedPort

  if (store.server) {
    const health = await probeHealth(store.port)
    if (health.lisekMock) {
      return buildState(store)
    }
    await closeAllServers(store)
  }

  if (port > 0 && (await isPortListening(port))) {
    const health = await probeHealth(port)
    if (health.lisekMock) {
      throw new Error(
        `Port ${port} is already used by a Lisek mock server instance. Click Stop, then Start again — or fully quit and reopen Lisek.`
      )
    }
    throw new Error(
      `Port ${port} is already in use (often a stale mock server after dev reload). Fully quit Lisek and reopen it, then click Start.`
    )
  }

  const nextServer = await listenOnPort(port)
  store.servers.push(nextServer)
  store.server = nextServer
  const address = nextServer.address()
  store.port = typeof address === 'object' && address ? address.port : port
  return buildState(store)
}

export async function restartMockServer(
  requestedPort: number = DEFAULT_PORT,
  verifyPath?: string
): Promise<MockServerState> {
  const port = requestedPort

  await closeAllServers(getStore())
  await new Promise((r) => setTimeout(r, 150))

  if (port > 0 && (await isPortListening(port))) {
    const health = await probeHealth(port)
    if (!health.lisekMock) {
      throw new Error(
        `Port ${port} is still in use by another process. Fully quit Lisek (all windows), reopen, and click Start again.`
      )
    }
  }

  const state = await startMockServer(port)
  if (verifyPath) {
    await verifyRunningServer(state.baseUrl, verifyPath)
  }
  return state
}

export async function stopMockServer(): Promise<MockServerState> {
  await closeAllServers(getStore())
  return buildState(getStore())
}

export function addMockRoute(route: Omit<MockRoute, 'id'>): MockServerState {
  const store = getStore()
  const id = uuidv4()
  store.routes.set(id, {
    ...route,
    id,
    method: route.method.trim().toUpperCase() || 'GET',
    path: normalizeMockPath(route.path)
  })
  persistRoutes(store.routes)
  return buildState(store)
}

export function updateMockRoute(id: string, route: Omit<MockRoute, 'id'>): MockServerState {
  const store = getStore()
  if (!store.routes.has(id)) {
    throw new Error(`Mock route not found: ${id}`)
  }
  store.routes.set(id, {
    ...route,
    id,
    method: route.method.trim().toUpperCase() || 'GET',
    path: normalizeMockPath(route.path)
  })
  persistRoutes(store.routes)
  return buildState(store)
}

export function removeMockRoute(id: string): MockServerState {
  const store = getStore()
  store.routes.delete(id)
  persistRoutes(store.routes)
  return buildState(store)
}

export function clearMockRoutes(): MockServerState {
  const store = getStore()
  store.routes.clear()
  persistRoutes(store.routes)
  return buildState(store)
}

export function ensureMockRoute(route: Omit<MockRoute, 'id'>): MockServerState {
  const store = getStore()
  const method = route.method.trim().toUpperCase() || 'GET'
  const path = normalizeMockPath(route.path)

  for (const existing of store.routes.values()) {
    if (existing.method.toUpperCase() === method && normalizeMockPath(existing.path) === path) {
      return buildState(store)
    }
  }

  return addMockRoute(route)
}

/** @deprecated use ensureMockRoute */
export function seedDefaultRouteIfEmpty(route: Omit<MockRoute, 'id'>): MockServerState {
  const store = getStore()
  if (store.routes.size > 0) return buildState(store)
  return addMockRoute(route)
}

export async function shutdownMockServer(): Promise<void> {
  await stopMockServer()
}

export async function reconcileMockServerOnStartup(): Promise<void> {
  const store = getStore()
  if (store.server) {
    const health = await probeHealth(store.port)
    if (!health.lisekMock) {
      await closeAllServers(store)
    }
    return
  }

  if (await isPortListening(DEFAULT_PORT)) {
    const health = await probeHealth(DEFAULT_PORT)
    if (!health.lisekMock) {
      // Stale listener from a previous dev session — nothing we can close safely here.
      console.warn(
        `[mock-server] Port ${DEFAULT_PORT} is occupied by a stale listener. Restart Lisek or use another port.`
      )
    }
  }
}
