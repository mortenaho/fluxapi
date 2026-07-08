import { Agent, ProxyAgent, fetch as undiciFetch } from 'undici'
import type { CookieRecord } from '../../../shared/types'
import {
  applyCookieHeader,
  extractSetCookieHeaders,
  storeSetCookieHeaders
} from './cookie-jar.service'

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const MAX_REDIRECTS = 20

export interface FetchOptions {
  sslVerify?: boolean
  followRedirects?: boolean
  proxyUrl?: string
}

function isLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0'
}

function createDispatcher(sslVerify: boolean, proxyUrl?: string, targetUrl?: string) {
  const tls = sslVerify === false ? { rejectUnauthorized: false as const } : undefined
  const bypassProxy = targetUrl ? isLocalHost(new URL(targetUrl).hostname) : false
  const effectiveProxy = proxyUrl?.trim() && !bypassProxy ? proxyUrl.trim() : undefined

  if (effectiveProxy) {
    return new ProxyAgent({
      uri: effectiveProxy,
      ...(tls ? { requestTls: tls, proxyTls: tls } : {})
    })
  }
  if (tls) return new Agent({ connect: tls })
  return undefined
}

export async function secureFetch(
  url: string,
  init: RequestInit,
  options: FetchOptions = {}
): Promise<Response> {
  const sslVerify = options.sslVerify !== false
  const dispatcher = createDispatcher(sslVerify, options.proxyUrl, url)
  if (!dispatcher) {
    return fetch(url, init)
  }
  return undiciFetch(url, { ...init, dispatcher } as never) as unknown as Response
}

export interface FetchWithCookieJarResult {
  response: Response
  storedCookies: CookieRecord[]
  finalUrl: URL
}

export async function fetchWithCookieJar(
  url: string,
  init: RequestInit,
  options: FetchOptions = {}
): Promise<FetchWithCookieJarResult> {
  const sslVerify = options.sslVerify !== false
  const followRedirects = options.followRedirects !== false
  const storedCookies: CookieRecord[] = []

  let currentUrl = new URL(url)
  let method = (init.method || 'GET').toUpperCase()
  let body = init.body
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string> | undefined) || {})
  }

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    applyCookieHeader(currentUrl, headers)

    const response = await secureFetch(
      currentUrl.toString(),
      {
        ...init,
        method,
        body,
        headers,
        redirect: 'manual'
      },
      options
    )

    storedCookies.push(...storeSetCookieHeaders(extractSetCookieHeaders(response), currentUrl))

    if (!followRedirects || !REDIRECT_STATUSES.has(response.status)) {
      return { response, storedCookies, finalUrl: currentUrl }
    }

    const location = response.headers.get('location')
    if (!location) {
      return { response, storedCookies, finalUrl: currentUrl }
    }

    if (redirects >= MAX_REDIRECTS) {
      throw new Error('Too many redirects')
    }

    if ([301, 302, 303].includes(response.status) && method !== 'GET' && method !== 'HEAD') {
      method = 'GET'
      body = undefined
      for (const key of Object.keys(headers)) {
        const lower = key.toLowerCase()
        if (lower === 'content-type' || lower === 'content-length') {
          delete headers[key]
        }
      }
    }

    currentUrl = new URL(location, currentUrl)
  }

  throw new Error('Too many redirects')
}
