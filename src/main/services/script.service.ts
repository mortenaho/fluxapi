import vm from 'node:vm'
import type { HttpMethod, HttpRequestPayload, HttpResponse, KeyValue, TestResult } from '../../../shared/types'

export interface ScriptContext {
  request: HttpRequestPayload
  response?: HttpResponse
  environmentVars: KeyValue[]
  collectionVars: KeyValue[]
}

export interface ScriptHostApi {
  alert?: (message: string) => void
  confirm?: (message: string) => boolean
}

export interface ScriptResult {
  environmentChanges: KeyValue[]
  collectionChanges: KeyValue[]
  requestChanges: Partial<HttpRequestPayload>
  testResults: TestResult[]
  console: string[]
}

function pushLog(result: ScriptResult, level: string, args: unknown[]) {
  const line = args.map(String).join(' ')
  result.console.push(level === 'log' ? line : `[${level}] ${line}`)
}

function mapVars(map: Map<string, string>): KeyValue[] {
  return Array.from(map.entries()).map(([key, value], i) => ({
    id: String(i),
    key,
    value,
    enabled: true
  }))
}

export function runScript(
  script: string,
  context: ScriptContext,
  phase: 'prerequest' | 'test',
  host: ScriptHostApi = {}
): ScriptResult {
  const result: ScriptResult = {
    environmentChanges: [...context.environmentVars],
    collectionChanges: [...context.collectionVars],
    requestChanges: {},
    testResults: [],
    console: []
  }

  if (!script?.trim()) return result

  const envMap = new Map(context.environmentVars.map((v) => [v.key, v.value]))
  const colMap = new Map(context.collectionVars.map((v) => [v.key, v.value]))
  const testResults: TestResult[] = []

  let reqUrl = context.request.url
  let reqMethod = context.request.method
  let reqBody = context.request.bodyRaw
  let reqHeaders = context.request.headers.map((h) => ({ ...h }))

  const syncRequestChanges = () => {
    result.requestChanges = {
      url: reqUrl,
      method: reqMethod,
      bodyRaw: reqBody,
      headers: reqHeaders
    }
  }

  const pm = {
    environment: {
      set: (key: string, value: string) => envMap.set(key, value),
      get: (key: string) => envMap.get(key),
      unset: (key: string) => {
        envMap.delete(key)
      }
    },
    collectionVariables: {
      set: (key: string, value: string) => colMap.set(key, value),
      get: (key: string) => colMap.get(key),
      unset: (key: string) => {
        colMap.delete(key)
      }
    },
    request: {
      get method() {
        return reqMethod
      },
      set method(value: string) {
        reqMethod = value.toUpperCase() as HttpMethod
        syncRequestChanges()
      },
      get url() {
        return reqUrl
      },
      set url(value: string) {
        reqUrl = value
        syncRequestChanges()
      },
      get headers() {
        return Object.fromEntries(
          reqHeaders.filter((h) => h.enabled).map((h) => [h.key, h.value])
        )
      },
      get body() {
        return { mode: 'raw', raw: reqBody }
      },
      set body(value: { raw?: string; mode?: string }) {
        if (value?.raw !== undefined) {
          reqBody = value.raw
          syncRequestChanges()
        }
      }
    },
    response: context.response
      ? {
          code: context.response.statusCode,
          status: context.response.statusText,
          headers: context.response.headers,
          text: () => context.response!.body,
          json: () => {
            try {
              return JSON.parse(context.response!.body)
            } catch {
              return null
            }
          }
        }
      : null,
    test: (name: string, fn: () => void) => {
      try {
        fn()
        testResults.push({ name, passed: true })
      } catch (e) {
        testResults.push({
          name,
          passed: false,
          error: e instanceof Error ? e.message : String(e)
        })
      }
    },
    expect: (actual: unknown) => ({
      to: {
        equal: (expected: unknown) => {
          if (actual !== expected) throw new Error(`Expected ${expected} but got ${actual}`)
        },
        eql: (expected: unknown) => {
          if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`)
          }
        },
        be: {
          ok: () => {
            if (!actual) throw new Error(`Expected truthy value but got ${actual}`)
          }
        }
      }
    }),
    variables: {
      set: (key: string, value: string) => envMap.set(key, value),
      get: (key: string) => envMap.get(key)
    }
  }

  const sandbox = {
    pm,
    alert: (message?: unknown) => {
      const text = String(message ?? '')
      if (host.alert) host.alert(text)
      else pushLog(result, 'log', [`alert: ${text}`])
    },
    confirm: (message?: unknown) => {
      const text = String(message ?? '')
      if (host.confirm) return host.confirm(text)
      pushLog(result, 'log', [`confirm: ${text} (default true)`])
      return true
    },
    console: {
      log: (...args: unknown[]) => pushLog(result, 'log', args),
      warn: (...args: unknown[]) => pushLog(result, 'warn', args),
      error: (...args: unknown[]) => pushLog(result, 'error', args)
    }
  }

  try {
    vm.createContext(sandbox)
    vm.runInContext(script, sandbox, { timeout: 5000, filename: `${phase}-script.js` })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const label = phase === 'prerequest' ? 'Pre-request script' : 'Test script'
    testResults.push({ name: label, passed: false, error: message })
    result.console.push(`${label} error: ${message}`)
  }

  result.environmentChanges = mapVars(envMap)
  result.collectionChanges = mapVars(colMap)
  result.testResults = testResults

  return result
}
