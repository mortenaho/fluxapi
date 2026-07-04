import { getAll, getOne, runQuery } from '../db'
import { readFileSync, writeFileSync } from 'fs'
import { basename } from 'path'
import { v4 as uuidv4 } from 'uuid'
import YAML from 'yaml'
import SwaggerParser from '@apidevtools/swagger-parser'
import type { KeyValue, OpenApiSpecModel, RequestModel } from '../../../shared/types'
import { saveRequest } from './repository'
import { fetchImportSource, type ImportFormatHint } from './fetch-import.service'

function parseImportContent(content: string, formatHint: ImportFormatHint = 'unknown'): unknown {
  if (formatHint === 'yaml') return YAML.parse(content)
  if (formatHint === 'json') return JSON.parse(content)
  const trimmed = content.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return JSON.parse(content)
  return YAML.parse(content)
}

function parseFileContent(filePath: string): unknown {
  const content = readFileSync(filePath, 'utf-8')
  const formatHint: ImportFormatHint =
    filePath.endsWith('.yaml') || filePath.endsWith('.yml') ? 'yaml' : 'json'
  return parseImportContent(content, formatHint)
}

export function importOpenApi(filePath: string) {
  const content = readFileSync(filePath, 'utf-8')
  const formatHint: ImportFormatHint =
    filePath.endsWith('.yaml') || filePath.endsWith('.yml') ? 'yaml' : 'json'
  return importOpenApiFromContent(content, basename(filePath), filePath, formatHint)
}

export async function importOpenApiFromUrl(url: string) {
  const fetched = await fetchImportSource(url)
  return importOpenApiFromContent(fetched.content, fetched.sourceLabel, url, fetched.formatHint)
}

export async function importOpenApiFromContent(
  content: string,
  sourceName: string,
  sourcePath: string,
  formatHint: ImportFormatHint = 'unknown'
): Promise<{
  collectionId: string
  specId: string
  count: number
}> {
  const raw = parseImportContent(content, formatHint)
  const api = await SwaggerParser.validate(raw as Parameters<typeof SwaggerParser.validate>[0])
  const specId = uuidv4()
  const collectionId = uuidv4()
  const now = Date.now()

  const isSwagger2 = !!(api as { swagger?: string }).swagger
  const title = (api as { info?: { title?: string; version?: string } }).info?.title || sourceName
  const version = (api as { info?: { title?: string; version?: string } }).info?.version || '1.0'

  let servers: string[] = []
  if ((api as { servers?: { url: string }[] }).servers) {
    servers = (api as { servers: { url: string }[] }).servers.map((s) => s.url)
  } else if ((api as { host?: string }).host) {
    const a = api as { host: string; basePath?: string; schemes?: string[] }
    const scheme = a.schemes?.[0] || 'https'
    servers = [`${scheme}://${a.host}${a.basePath || ''}`]
  }

  runQuery(
    'INSERT INTO openapi_specs (id, name, file_path, format, content, title, version, servers_json, imported_at) VALUES (?,?,?,?,?,?,?,?,?)',
    [specId, sourceName, sourcePath, isSwagger2 ? 'swagger2' : 'openapi3', content, title, version, JSON.stringify(servers), now]
  )

  runQuery(
    'INSERT INTO collections (id, name, parent_id, sort_order, variables_json, created_at) VALUES (?,?,?,?,?,?)',
    [collectionId, title, null, 0, JSON.stringify([{ id: '1', key: 'baseUrl', value: servers[0] || '', enabled: true }]), now]
  )

  const paths = (api as { paths?: Record<string, Record<string, unknown>> }).paths || {}
  const tagFolders = new Map<string, string>()
  let count = 0

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method)) {
        const op = operation as {
          operationId?: string
          summary?: string
          tags?: string[]
          parameters?: Array<{ name: string; in: string; schema?: { example?: unknown }; example?: unknown }>
          requestBody?: { content?: Record<string, { example?: unknown; schema?: { example?: unknown } }> }
        }

        const tag = op.tags?.[0] || 'Default'
        if (!tagFolders.has(tag)) {
          const folderId = uuidv4()
          tagFolders.set(tag, folderId)
          runQuery(
            'INSERT INTO collections (id, name, parent_id, sort_order, variables_json, created_at) VALUES (?,?,?,?,?,?)',
            [folderId, tag, collectionId, tagFolders.size, '[]', now]
          )
        }

        const headers: KeyValue[] = []
        const params: KeyValue[] = []
        let bodyRaw = ''
        let bodyType: RequestModel['bodyType'] = 'none'

        for (const p of op.parameters || []) {
          const kv: KeyValue = {
            id: uuidv4(),
            key: p.name,
            value: String(p.example ?? p.schema?.example ?? ''),
            enabled: true
          }
          if (p.in === 'header') headers.push(kv)
          else if (p.in === 'query') params.push(kv)
        }

        if (op.requestBody?.content) {
          bodyType = 'raw'
          const jsonContent = op.requestBody.content['application/json']
          if (jsonContent?.example) bodyRaw = JSON.stringify(jsonContent.example, null, 2)
          else if (jsonContent?.schema?.example) bodyRaw = JSON.stringify(jsonContent.schema.example, null, 2)
        }

        saveRequest({
          collectionId: tagFolders.get(tag)!,
          name: op.summary || op.operationId || `${method.toUpperCase()} ${path}`,
          method: method.toUpperCase() as RequestModel['method'],
          url: `{{baseUrl}}${path}`,
          headers,
          params,
          bodyType,
          bodyRaw,
          protocol: 'http'
        })
        count++
      }
    }
  }

  return { collectionId, specId, count }
}

export function listOpenApiSpecs(): OpenApiSpecModel[] {
  const rows = getAll<{
    id: string
    name: string
    file_path: string
    format: string
    content: string
    title: string
    version: string
    servers_json: string
    imported_at: number
  }>('SELECT * FROM openapi_specs')
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    filePath: r.file_path,
    format: r.format as 'openapi3' | 'swagger2',
    content: r.content,
    title: r.title,
    version: r.version,
    servers: JSON.parse(r.servers_json),
    importedAt: r.imported_at
  }))
}

export function deleteOpenApiSpec(id: string) {
  runQuery('DELETE FROM openapi_specs WHERE id = ?', [id])
}

export function getOpenApiPaths(specId: string): import('../../../shared/types').OpenApiPathItem[] {
  const spec = listOpenApiSpecs().find((s) => s.id === specId)
  if (!spec) return []

  const raw = spec.content.startsWith('{') ? JSON.parse(spec.content) : YAML.parse(spec.content)
  const paths = (raw as { paths?: Record<string, Record<string, unknown>> }).paths || {}
  const items: import('../../../shared/types').OpenApiPathItem[] = []

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method)) continue
      const op = operation as { summary?: string; operationId?: string }
      items.push({
        path,
        method: method.toUpperCase(),
        summary: op.summary || op.operationId || `${method.toUpperCase()} ${path}`,
        operationId: op.operationId
      })
    }
  }

  return items.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method))
}

export function generateRequestFromSpec(
  specId: string,
  path: string,
  method: string,
  collectionId: string | null = null
): RequestModel {
  const spec = listOpenApiSpecs().find((s) => s.id === specId)
  if (!spec) throw new Error('OpenAPI spec not found')

  const raw = spec.content.startsWith('{') ? JSON.parse(spec.content) : YAML.parse(spec.content)
  const pathItem = (raw as { paths?: Record<string, Record<string, unknown>> }).paths?.[path]
  const op = pathItem?.[method.toLowerCase()] as {
    summary?: string
    operationId?: string
    parameters?: Array<{ name: string; in: string; schema?: { example?: unknown }; example?: unknown }>
    requestBody?: { content?: Record<string, { example?: unknown; schema?: { example?: unknown } }> }
  } | undefined

  const headers: KeyValue[] = []
  const params: KeyValue[] = []
  let bodyRaw = ''
  let bodyType: RequestModel['bodyType'] = 'none'

  for (const p of op?.parameters || []) {
    const kv: KeyValue = {
      id: uuidv4(),
      key: p.name,
      value: String(p.example ?? p.schema?.example ?? ''),
      enabled: true
    }
    if (p.in === 'header') headers.push(kv)
    else if (p.in === 'query') params.push(kv)
  }

  if (op?.requestBody?.content) {
    bodyType = 'raw'
    const jsonContent = op.requestBody.content['application/json']
    if (jsonContent?.example) bodyRaw = JSON.stringify(jsonContent.example, null, 2)
    else if (jsonContent?.schema?.example) bodyRaw = JSON.stringify(jsonContent.schema.example, null, 2)
  }

  const baseUrl = spec.servers[0] || '{{baseUrl}}'
  const base = baseUrl.replace(/\/$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  return saveRequest({
    collectionId,
    name: op?.summary || op?.operationId || `${method.toUpperCase()} ${path}`,
    method: method.toUpperCase() as RequestModel['method'],
    url: `${base}${normalizedPath}`,
    headers,
    params,
    bodyType,
    bodyRaw,
    bodyRawContentType: 'application/json',
    protocol: 'http'
  })
}

export function exportToOpenApi(collectionId: string, filePath: string) {
  const col = getOne<{ name: string }>('SELECT name FROM collections WHERE id = ?', [collectionId])
  const reqs = getAll<{ url: string; method: string; name: string }>(
    'SELECT url, method, name FROM requests WHERE collection_id = ?',
    [collectionId]
  )

  const spec = {
    openapi: '3.0.0',
    info: { title: col?.name || 'FluxAPI Export', version: '1.0.0' },
    servers: [{ url: '{{baseUrl}}' }],
    paths: {} as Record<string, Record<string, unknown>>
  }

  for (const req of reqs) {
    const path = req.url.replace('{{baseUrl}}', '') || '/'
    if (!spec.paths[path]) spec.paths[path] = {}
    spec.paths[path][req.method.toLowerCase()] = {
      summary: req.name,
      responses: { '200': { description: 'OK' } }
    }
  }

  writeFileSync(filePath, JSON.stringify(spec, null, 2))
}
