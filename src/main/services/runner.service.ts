import { writeFileSync } from 'fs'
import type {
  CollectionRunOptions,
  CollectionRunReport,
  CollectionRunResult,
  HttpRequestPayload
} from '../../../shared/types'
import { resolveCollectionVariables } from '../../../shared/collectionVariables'
import {
  listRequests,
  saveRequestLastResponse,
  listCollections,
  getActiveEnvironment,
  saveEnvironment
} from './repository'
import { sendHttpRequest } from './http.service'
import { runScript } from './script.service'
import { getSettings } from '../db'
import { parseRunnerDataFile, mergeDataRow } from './runner-data.service'
import type { KeyValue } from '../../../shared/types'

function collectCollectionRequestIds(collectionId: string, allCollections: { id: string; parentId: string | null }[]): string[] {
  const childIds = allCollections.filter((c) => c.parentId === collectionId).map((c) => c.id)
  return [collectionId, ...childIds.flatMap((id) => collectCollectionRequestIds(id, allCollections))]
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runSingleRequest(
  req: ReturnType<typeof listRequests>[number],
  options: CollectionRunOptions & { sslVerify?: boolean; timeoutMs?: number; followRedirects?: boolean; proxyUrl?: string },
  iteration: number,
  envOverride?: KeyValue[],
  dataRow?: number
): Promise<CollectionRunResult> {
  const collections = listCollections()
  const activeEnv = getActiveEnvironment()
  const envVars = envOverride ?? activeEnv?.variables ?? []

  if (req.protocol !== 'http' && req.protocol !== 'graphql') {
    return {
      requestId: req.id,
      requestName: req.name,
      statusCode: 0,
      passed: false,
      error: `Skipped (${req.protocol} not supported in runner)`,
      durationMs: 0,
      iteration,
      dataRow
    }
  }

  try {
    const collectionVars = resolveCollectionVariables(req.collectionId, collections)

    const payload: HttpRequestPayload = {
      requestId: req.id,
      method: req.method,
      url: req.url,
      headers: req.headers,
      params: req.params,
      bodyType: req.protocol === 'graphql' ? 'raw' : req.bodyType,
      bodyRaw:
        req.protocol === 'graphql'
          ? JSON.stringify({ query: req.graphqlQuery, variables: JSON.parse(req.graphqlVariables || '{}') })
          : req.bodyRaw,
      bodyRawContentType: req.protocol === 'graphql' ? 'application/json' : req.bodyRawContentType,
      formData: req.formData,
      urlEncoded: req.urlEncoded,
      authType: req.authType,
      auth: req.auth,
      preRequestScript: req.preRequestScript,
      testScript: req.testScript,
      collectionVariables: collectionVars
    }

    let processedPayload = { ...payload }
    let resolvedCollectionVars = collectionVars
    if (payload.preRequestScript) {
      const scriptResult = runScript(
        payload.preRequestScript,
        { request: payload, environmentVars: envVars, collectionVars: resolvedCollectionVars },
        'prerequest'
      )
      if (scriptResult.requestChanges.url) processedPayload.url = scriptResult.requestChanges.url
      resolvedCollectionVars = scriptResult.collectionChanges
    }

    const response = await sendHttpRequest(processedPayload, envVars, resolvedCollectionVars, {
      sslVerify: options.sslVerify,
      timeoutMs: options.timeoutMs,
      followRedirects: options.followRedirects,
      proxyUrl: options.proxyUrl
    })

    let testResults: { name: string; passed: boolean; error?: string }[] = []
    let environmentChanges = envVars

    if (payload.testScript) {
      const scriptResult = runScript(
        payload.testScript,
        { request: processedPayload, response, environmentVars: envVars, collectionVars: resolvedCollectionVars },
        'test'
      )
      testResults = scriptResult.testResults
      environmentChanges = scriptResult.environmentChanges
    }

    if (activeEnv && environmentChanges !== envVars) {
      saveEnvironment({ ...activeEnv, variables: environmentChanges })
    }

    saveRequestLastResponse(req.id, response, testResults)

    const passed = testResults.length === 0 || testResults.every((t) => t.passed)
    return {
      requestId: req.id,
      requestName: req.name,
      statusCode: response.statusCode,
      passed,
      error: testResults.find((t) => !t.passed)?.error,
      durationMs: response.durationMs,
      iteration,
      dataRow
    }
  } catch (e) {
    return {
      requestId: req.id,
      requestName: req.name,
      statusCode: 0,
      passed: false,
      error: e instanceof Error ? e.message : String(e),
      durationMs: 0,
      iteration,
      dataRow
    }
  }
}

export async function runCollection(
  collectionId: string,
  options: CollectionRunOptions & { sslVerify?: boolean; timeoutMs?: number; followRedirects?: boolean; proxyUrl?: string } = {}
): Promise<CollectionRunResult[]> {
  const settings = getSettings()
  const iterations = Math.max(1, options.iterations ?? settings.runnerIterations ?? 1)
  const delayMs = Math.max(0, options.delayMs ?? settings.runnerDelayMs ?? 0)

  const collections = listCollections()
  const collectionIds = collectCollectionRequestIds(collectionId, collections)
  const allRequests = listRequests()
    .filter((r) => r.collectionId && collectionIds.includes(r.collectionId))
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const results: CollectionRunResult[] = []
  const dataRows = options.dataFilePath
    ? parseRunnerDataFile(options.dataFilePath, options.dataFileFormat)
    : [null]

  for (let iteration = 1; iteration <= iterations; iteration++) {
    for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
      const dataRowVars = dataRows[rowIndex]
      const activeEnv = getActiveEnvironment()
      const mergedEnv = dataRowVars
        ? mergeDataRow(activeEnv?.variables || [], dataRowVars)
        : activeEnv?.variables

      for (const req of allRequests) {
        const result = await runSingleRequest(
          req,
          options,
          iteration,
          mergedEnv,
          dataRows.length > 1 || dataRowVars ? rowIndex + 1 : undefined
        )
        results.push(result)

        if (!result.passed && options.stopOnFailure) {
          return results
        }

        if (delayMs > 0) {
          await delay(delayMs)
        }
      }
    }
  }

  return results
}

export function buildCollectionRunReport(
  collectionId: string,
  results: CollectionRunResult[],
  options: CollectionRunOptions = {}
): CollectionRunReport {
  const settings = getSettings()
  const collections = listCollections()
  const collection = collections.find((c) => c.id === collectionId)
  const passed = results.filter((r) => r.passed).length
  const failed = results.length - passed

  return {
    collectionId,
    collectionName: collection?.name || 'Collection',
    startedAt: Date.now(),
    finishedAt: Date.now(),
    iterations: Math.max(1, options.iterations ?? settings.runnerIterations ?? 1),
    delayMs: Math.max(0, options.delayMs ?? settings.runnerDelayMs ?? 0),
    results,
    passed,
    failed
  }
}

export function exportRunnerReport(report: CollectionRunReport, filePath: string, format: 'json' | 'html'): void {
  if (format === 'json') {
    writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8')
    return
  }

  const rows = report.results
    .map(
      (r) =>
        `<tr class="${r.passed ? 'pass' : 'fail'}"><td>${escapeHtml(r.requestName)}</td><td>${r.iteration ?? 1}</td><td>${r.statusCode || '—'}</td><td>${r.passed ? 'PASS' : 'FAIL'}</td><td>${r.durationMs} ms</td><td>${escapeHtml(r.error || '')}</td></tr>`
    )
    .join('\n')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Lisek Runner — ${escapeHtml(report.collectionName)}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; color: #1a1a1a; }
    h1 { font-size: 1.25rem; margin-bottom: 0.25rem; }
    .meta { color: #666; font-size: 0.875rem; margin-bottom: 1rem; }
    table { border-collapse: collapse; width: 100%; font-size: 0.875rem; }
    th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
    th { background: #f5f5f5; }
    tr.pass td:nth-child(4) { color: #2e7d32; font-weight: 600; }
    tr.fail td:nth-child(4) { color: #c62828; font-weight: 600; }
  </style>
</head>
<body>
  <h1>${escapeHtml(report.collectionName)}</h1>
  <p class="meta">${report.passed}/${report.results.length} passed · ${report.iterations} iteration(s) · delay ${report.delayMs} ms</p>
  <table>
    <thead><tr><th>Request</th><th>Iteration</th><th>Status</th><th>Result</th><th>Duration</th><th>Error</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`

  writeFileSync(filePath, html, 'utf-8')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
