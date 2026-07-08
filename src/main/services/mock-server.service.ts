import http from 'http'
import { v4 as uuidv4 } from 'uuid'
import type { MockRoute, MockServerState } from '../../../shared/types'

const routes = new Map<string, MockRoute>()
let server: http.Server | null = null
let port = 0

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

function buildState(): MockServerState {
  return {
    running: server !== null,
    port,
    baseUrl: server ? `http://127.0.0.1:${port}` : '',
    routes: Array.from(routes.values())
  }
}

function matchRoute(method: string, pathname: string): MockRoute | null {
  const normalizedMethod = method.toUpperCase()
  const normalizedPath = normalizeMockPath(pathname)

  for (const route of routes.values()) {
    const routePath = normalizeMockPath(route.path)
    const routeMethod = route.method.toUpperCase()
    if (routeMethod !== normalizedMethod && routeMethod !== 'ANY' && routeMethod !== '*') continue
    if (routePath === '*' || routePath === normalizedPath) return route
  }
  return null
}

export function getMockServerState(): MockServerState {
  return buildState()
}

export function startMockServer(requestedPort = 0): Promise<MockServerState> {
  if (server) return Promise.resolve(buildState())

  return new Promise((resolve, reject) => {
    const nextServer = http.createServer((req, res) => {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders())
        res.end()
        return
      }

      const url = new URL(req.url || '/', `http://127.0.0.1:${port || requestedPort || 80}`)
      const route = matchRoute(req.method || 'GET', url.pathname)
      if (!route) {
        res.writeHead(404, { 'content-type': 'application/json', ...corsHeaders() })
        res.end(JSON.stringify({ error: 'No mock route matched', method: req.method, path: url.pathname }))
        return
      }

      const headers = { ...corsHeaders(), ...route.headers }
      if (!headers['content-type']) {
        headers['content-type'] = 'application/json'
      }
      res.writeHead(route.statusCode, headers)
      res.end(route.body)
    })

    nextServer.once('error', (err) => {
      nextServer.close()
      if (server === nextServer) {
        server = null
        port = 0
      }
      reject(err)
    })

    nextServer.listen(requestedPort, '127.0.0.1', () => {
      server = nextServer
      const address = server.address()
      port = typeof address === 'object' && address ? address.port : requestedPort
      resolve(buildState())
    })
  })
}

export function stopMockServer(): Promise<MockServerState> {
  if (!server) return Promise.resolve(buildState())

  return new Promise((resolve) => {
    const current = server
    server = null
    port = 0
    current?.close(() => resolve(buildState()))
  })
}

export function addMockRoute(route: Omit<MockRoute, 'id'>): MockServerState {
  const id = uuidv4()
  routes.set(id, {
    ...route,
    id,
    method: route.method.trim().toUpperCase() || 'GET',
    path: normalizeMockPath(route.path)
  })
  return buildState()
}

export function removeMockRoute(id: string): MockServerState {
  routes.delete(id)
  return buildState()
}

export function clearMockRoutes(): MockServerState {
  routes.clear()
  return buildState()
}
