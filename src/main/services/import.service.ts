import { readFileSync, writeFileSync } from 'fs'
import { basename } from 'path'
import { v4 as uuidv4 } from 'uuid'
import YAML from 'yaml'
import { getAll, getOne, runQuery } from '../db'
import type { AuthConfig, AuthType, KeyValue, RequestModel } from '../../../shared/types'
import { maskSecretKeyValues, maskSecretValue } from '../../../shared/secretExport'
import { rowToRequest, saveRequest } from './repository'
import { fetchImportSource, type ImportFormatHint } from './fetch-import.service'

interface PostmanItem {
  name: string
  item?: PostmanItem[]
  request?: {
    method?: string
    header?: { key: string; value: string; disabled?: boolean }[]
    url?: string | { raw?: string; query?: { key: string; value: string; disabled?: boolean }[] }
    body?: {
      mode?: string
      raw?: string
      urlencoded?: { key: string; value: string; disabled?: boolean }[]
      formdata?: { key: string; value: string; disabled?: boolean }[]
    }
    auth?: {
      type?: string
      bearer?: { token?: string }[]
      basic?: { username?: string; password?: string }[]
      apikey?: { key?: string; value?: string; in?: string }[]
    }
  }
  event?: { listen: string; script: { exec: string[] } }[]
}

interface PostmanCollection {
  info?: { name?: string; schema?: string }
  item?: PostmanItem[]
  variable?: { key: string; value: string }[]
}

interface InsomniaResource {
  _type: string
  _id: string
  parentId?: string | null
  name?: string
  metaSortKey?: number
  method?: string
  url?: string
  body?: { mimeType?: string; text?: string }
  headers?: { name: string; value: string; disabled?: boolean }[]
  parameters?: { name: string; value: string; disabled?: boolean }[]
  authentication?: {
    type?: string
    token?: string
    username?: string
    password?: string
    key?: string
    value?: string
    addTo?: string
  }
}

function parseImportContent(
  content: string,
  label: string,
  formatHint: ImportFormatHint = 'unknown'
): unknown {
  try {
    if (formatHint === 'json') return JSON.parse(content)
    if (formatHint === 'yaml') return YAML.parse(content)

    const trimmed = content.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) return JSON.parse(content)
    return YAML.parse(content)
  } catch {
    throw new Error(`Invalid JSON or YAML in ${label}`)
  }
}

function detectFileFormatHint(filePathOrName: string): ImportFormatHint {
  const lower = filePathOrName.toLowerCase()
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'yaml'
  if (lower.endsWith('.json')) return 'json'
  return 'unknown'
}

export function importPostman(filePath: string): { collectionId: string; count: number } {
  return importPostmanFromContent(readFileSync(filePath, 'utf-8'), basename(filePath), detectFileFormatHint(filePath))
}

export async function importPostmanFromUrl(url: string): Promise<{ collectionId: string; count: number }> {
  const fetched = await fetchImportSource(url)
  return importPostmanFromContent(fetched.content, fetched.sourceLabel, fetched.formatHint)
}

export function importPostmanFromContent(
  content: string,
  sourceName: string,
  formatHint: ImportFormatHint = detectFileFormatHint(sourceName)
): { collectionId: string; count: number } {
  const parsed = parseImportContent(content, sourceName, formatHint)
  if (isInsomniaExport(parsed)) {
    throw new Error('This URL points to an Insomnia export. Use Import → Insomnia instead.')
  }
  if (!isPostmanCollection(parsed)) {
    throw new Error('Not a valid Postman Collection v2.1 export')
  }

  const data = parsed as PostmanCollection
  const rootId = uuidv4()
  const now = Date.now()
  let count = 0

  runQuery(
    'INSERT INTO collections (id, name, parent_id, sort_order, variables_json, created_at) VALUES (?,?,?,?,?,?)',
    [
      rootId,
      data.info?.name || sourceName || 'Imported Collection',
      null,
      0,
      JSON.stringify(
        (data.variable || []).map((v, i) => ({
          id: String(i),
          key: v.key,
          value: v.value,
          enabled: true
        }))
      ),
      now
    ]
  )

  function processItems(items: PostmanItem[], parentId: string) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.item) {
        const folderId = uuidv4()
        runQuery(
          'INSERT INTO collections (id, name, parent_id, sort_order, variables_json, created_at) VALUES (?,?,?,?,?,?)',
          [folderId, item.name, parentId, i, '[]', now]
        )
        processItems(item.item, folderId)
      } else if (item.request) {
        saveRequest(mapPostmanRequest(item, parentId, i, now))
        count++
      }
    }
  }

  processItems(data.item || [], rootId)
  return { collectionId: rootId, count }
}

export function importInsomnia(filePath: string): { collectionId: string; count: number } {
  return importInsomniaFromContent(readFileSync(filePath, 'utf-8'), basename(filePath), detectFileFormatHint(filePath))
}

export async function importInsomniaFromUrl(url: string): Promise<{ collectionId: string; count: number }> {
  const fetched = await fetchImportSource(url)
  return importInsomniaFromContent(fetched.content, fetched.sourceLabel, fetched.formatHint)
}

export function importInsomniaFromContent(
  content: string,
  sourceName: string,
  formatHint: ImportFormatHint = detectFileFormatHint(sourceName)
): { collectionId: string; count: number } {
  const parsed = parseImportContent(content, sourceName, formatHint)
  if (!isInsomniaExport(parsed)) {
    throw new Error('Not a valid Insomnia export')
  }

  const data = parsed as { resources?: InsomniaResource[] }
  const resources = data.resources || []
  const workspace = resources.find((r) => r._type === 'workspace')
  const rootId = uuidv4()
  const now = Date.now()
  const idMap = new Map<string, string>()

  if (workspace?._id) idMap.set(workspace._id, rootId)

  runQuery(
    'INSERT INTO collections (id, name, parent_id, sort_order, variables_json, created_at) VALUES (?,?,?,?,?,?)',
    [rootId, workspace?.name || sourceName || 'Imported Insomnia', null, 0, '[]', now]
  )

  const groups = resources
    .filter((r) => r._type === 'request_group')
    .sort((a, b) => (a.metaSortKey ?? 0) - (b.metaSortKey ?? 0))

  const pending = [...groups]
  while (pending.length > 0) {
    let progressed = false
    for (let i = pending.length - 1; i >= 0; i--) {
      const group = pending[i]
      const parentKey = group.parentId || workspace?._id
      if (!parentKey || idMap.has(parentKey)) {
        const folderId = uuidv4()
        idMap.set(group._id, folderId)
        runQuery(
          'INSERT INTO collections (id, name, parent_id, sort_order, variables_json, created_at) VALUES (?,?,?,?,?,?)',
          [folderId, group.name || 'Folder', idMap.get(parentKey!) ?? rootId, i, '[]', now]
        )
        pending.splice(i, 1)
        progressed = true
      }
    }
    if (!progressed) {
      for (const group of pending) {
        const folderId = uuidv4()
        idMap.set(group._id, folderId)
        runQuery(
          'INSERT INTO collections (id, name, parent_id, sort_order, variables_json, created_at) VALUES (?,?,?,?,?,?)',
          [folderId, group.name || 'Folder', rootId, 0, '[]', now]
        )
      }
      break
    }
  }

  const requests = resources
    .filter((r) => r._type === 'request')
    .sort((a, b) => (a.metaSortKey ?? 0) - (b.metaSortKey ?? 0))

  let count = 0
  for (let i = 0; i < requests.length; i++) {
    const req = requests[i]
    const parentId = idMap.get(req.parentId || workspace?._id || '') ?? rootId
    saveRequest(mapInsomniaRequest(req, parentId, i, now))
    count++
  }

  return { collectionId: rootId, count }
}

function isPostmanCollection(data: unknown): data is PostmanCollection {
  if (typeof data !== 'object' || !data) return false
  const d = data as PostmanCollection
  return !!(d.info?.schema?.includes('postman.com') || Array.isArray(d.item))
}

function isInsomniaExport(data: unknown): boolean {
  if (typeof data !== 'object' || !data) return false
  const d = data as { __export_format?: number; resources?: InsomniaResource[] }
  if (d.__export_format !== undefined) return true
  return Array.isArray(d.resources) && d.resources.some((r) => r._type === 'request' || r._type === 'workspace')
}

function mapInsomniaRequest(
  item: InsomniaResource,
  collectionId: string,
  sortOrder: number,
  now: number
): RequestModel {
  const headers: KeyValue[] = (item.headers || []).map((h, i) => ({
    id: String(i),
    key: h.name,
    value: h.value,
    enabled: !h.disabled
  }))

  const params: KeyValue[] = (item.parameters || []).map((p, i) => ({
    id: String(i),
    key: p.name,
    value: p.value,
    enabled: !p.disabled
  }))

  let bodyType: RequestModel['bodyType'] = 'none'
  let bodyRaw = ''
  let bodyRawContentType = 'application/json'

  if (item.body?.text) {
    bodyType = 'raw'
    bodyRaw = item.body.text
    bodyRawContentType = item.body.mimeType || 'text/plain'
  }

  let authType: AuthType = 'none'
  const auth: AuthConfig = {}
  const a = item.authentication
  if (a?.type === 'bearer') {
    authType = 'bearer'
    auth.bearerToken = a.token || ''
  } else if (a?.type === 'basic') {
    authType = 'basic'
    auth.basicUsername = a.username || ''
    auth.basicPassword = a.password || ''
  } else if (a?.type === 'apikey') {
    authType = 'apikey'
    auth.apiKeyKey = a.key || ''
    auth.apiKeyValue = a.value || ''
    auth.apiKeyIn = a.addTo === 'queryParams' ? 'query' : 'header'
  }

  return {
    id: uuidv4(),
    collectionId,
    name: item.name || 'Imported Request',
    method: (item.method?.toUpperCase() || 'GET') as RequestModel['method'],
    url: item.url || '',
    headers,
    params,
    bodyType,
    bodyRaw,
    bodyRawContentType,
    formData: [],
    urlEncoded: [],
    authType,
    auth,
    preRequestScript: '',
    testScript: '',
    protocol: 'http',
    graphqlQuery: '',
    graphqlVariables: '{}',
    graphqlOperationType: 'query',
    wsUrl: '',
    wsMessages: [],
    sseUrl: '',
    sseMessages: [],
    grpcTarget: '',
    grpcService: '',
    grpcMethod: '',
    grpcCallType: 'unary',
    grpcProtoId: null,
    grpcMetadata: [],
    grpcMessage: '{}',
    sortOrder,
    pinned: false,
    createdAt: now,
    updatedAt: now
  }
}

function mapPostmanRequest(item: PostmanItem, collectionId: string, sortOrder: number, now: number): RequestModel {
  const r = item.request!
  let url = ''
  const params: KeyValue[] = []

  if (typeof r.url === 'string') url = r.url
  else if (r.url) {
    url = r.url.raw || ''
    for (const q of r.url.query || []) {
      params.push({ id: uuidv4(), key: q.key, value: q.value, enabled: !q.disabled })
    }
  }

  const headers: KeyValue[] = (r.header || []).map((h, i) => ({
    id: String(i),
    key: h.key,
    value: h.value,
    enabled: !h.disabled
  }))

  let bodyType: RequestModel['bodyType'] = 'none'
  let bodyRaw = ''
  const formData: KeyValue[] = []
  const urlEncoded: KeyValue[] = []

  if (r.body) {
    if (r.body.mode === 'raw') {
      bodyType = 'raw'
      bodyRaw = r.body.raw || ''
    } else if (r.body.mode === 'urlencoded') {
      bodyType = 'x-www-form-urlencoded'
      for (const u of r.body.urlencoded || []) {
        urlEncoded.push({ id: uuidv4(), key: u.key, value: u.value, enabled: !u.disabled })
      }
    } else if (r.body.mode === 'formdata') {
      bodyType = 'form-data'
      for (const f of r.body.formdata || []) {
        formData.push({ id: uuidv4(), key: f.key, value: f.value, enabled: !f.disabled })
      }
    }
  }

  let authType: AuthType = 'none'
  const auth: AuthConfig = {}
  if (r.auth?.type === 'bearer') {
    authType = 'bearer'
    auth.bearerToken = r.auth.bearer?.[0]?.token || ''
  } else if (r.auth?.type === 'basic') {
    authType = 'basic'
    auth.basicUsername = r.auth.basic?.[0]?.username || ''
    auth.basicPassword = r.auth.basic?.[0]?.password || ''
  } else if (r.auth?.type === 'apikey') {
    authType = 'apikey'
    auth.apiKeyKey = r.auth.apikey?.[0]?.key || ''
    auth.apiKeyValue = r.auth.apikey?.[0]?.value || ''
    auth.apiKeyIn = (r.auth.apikey?.[0]?.in as 'header' | 'query') || 'header'
  }

  let preRequestScript = ''
  let testScript = ''
  for (const e of item.event || []) {
    if (e.listen === 'prerequest') preRequestScript = e.script.exec.join('\n')
    if (e.listen === 'test') testScript = e.script.exec.join('\n')
  }

  return {
    id: uuidv4(),
    collectionId,
    name: item.name,
    method: (r.method?.toUpperCase() || 'GET') as RequestModel['method'],
    url,
    headers,
    params,
    bodyType,
    bodyRaw,
    bodyRawContentType: 'application/json',
    formData,
    urlEncoded,
    authType,
    auth,
    preRequestScript,
    testScript,
    protocol: 'http',
    graphqlQuery: '',
    graphqlVariables: '{}',
    graphqlOperationType: 'query',
    wsUrl: '',
    wsMessages: [],
    sseUrl: '',
    sseMessages: [],
    grpcTarget: '',
    grpcService: '',
    grpcMethod: '',
    grpcCallType: 'unary',
    grpcProtoId: null,
    grpcMetadata: [],
    grpcMessage: '{}',
    sortOrder,
    pinned: false,
    createdAt: now,
    updatedAt: now
  }
}

export function exportPostman(collectionId: string, filePath: string) {
  const col = getOne<{ name: string; variables_json: string }>('SELECT name, variables_json FROM collections WHERE id = ?', [
    collectionId
  ])
  const allCols = getAll<{ id: string; name: string; parent_id: string | null }>('SELECT id, name, parent_id FROM collections')
  const allReqs = getAll<Parameters<typeof rowToRequest>[0]>('SELECT * FROM requests')

  const childCollections = allCols.filter((c) => c.parent_id === collectionId)
  const childRequests = allReqs.filter((r) => r.collection_id === collectionId)

  const item = [
    ...childCollections.map((c) => buildFolder(c, allCols, allReqs)),
    ...childRequests.map((r) => buildPostmanItem(rowToRequest(r)))
  ]

  const output = {
    info: {
      name: col?.name || 'Export',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    item,
    variable: maskSecretKeyValues(JSON.parse(col?.variables_json || '[]')).map((v: KeyValue) => ({
      key: v.key,
      value: maskSecretValue(v)
    }))
  }

  writeFileSync(filePath, JSON.stringify(output, null, 2))
}

function buildFolder(
  col: { id: string; name: string; parent_id: string | null },
  allCols: { id: string; name: string; parent_id: string | null }[],
  allReqs: Parameters<typeof rowToRequest>[0][]
): PostmanItem {
  const children = allCols.filter((c) => c.parent_id === col.id)
  const reqs = allReqs.filter((r) => r.collection_id === col.id)
  return {
    name: col.name,
    item: [
      ...children.map((c) => buildFolder(c, allCols, allReqs)),
      ...reqs.map((r) => buildPostmanItem(rowToRequest(r)))
    ]
  }
}

function buildPostmanItem(req: RequestModel): PostmanItem {
  const events = []
  if (req.preRequestScript) events.push({ listen: 'prerequest', script: { exec: req.preRequestScript.split('\n') } })
  if (req.testScript) events.push({ listen: 'test', script: { exec: req.testScript.split('\n') } })

  const headers = maskSecretKeyValues(req.headers)
  const params = maskSecretKeyValues(req.params)
  const formData = maskSecretKeyValues(req.formData)
  const urlEncoded = maskSecretKeyValues(req.urlEncoded)

  return {
    name: req.name,
    event: events.length > 0 ? events : undefined,
    request: {
      method: req.method,
      header: headers.map((h) => ({ key: h.key, value: maskSecretValue(h), disabled: !h.enabled })),
      url: { raw: req.url, query: params.map((p) => ({ key: p.key, value: maskSecretValue(p), disabled: !p.enabled })) },
      body:
        req.bodyType === 'none'
          ? undefined
          : {
              mode: req.bodyType === 'raw' ? 'raw' : req.bodyType === 'form-data' ? 'formdata' : 'urlencoded',
              raw: req.bodyRaw,
              formdata: formData.map((f) => ({ key: f.key, value: maskSecretValue(f), disabled: !f.enabled })),
              urlencoded: urlEncoded.map((u) => ({ key: u.key, value: maskSecretValue(u), disabled: !u.enabled }))
            }
    }
  }
}

export function exportInsomnia(collectionId: string, filePath: string) {
  const col = getOne<{ name: string; variables_json: string }>('SELECT name, variables_json FROM collections WHERE id = ?', [
    collectionId
  ])
  const allCols = getAll<{ id: string; name: string; parent_id: string | null; sort_order: number }>(
    'SELECT id, name, parent_id, sort_order FROM collections'
  )
  const allReqs = getAll<Parameters<typeof rowToRequest>[0]>('SELECT * FROM requests')

  const workspaceId = uuidv4()
  const resources: Record<string, unknown>[] = [
    {
      _type: 'export',
      __export_format: 4,
      __export_date: new Date().toISOString(),
      __export_source: 'lisek'
    },
    {
      _id: workspaceId,
      _type: 'workspace',
      name: col?.name || 'Export',
      description: ''
    }
  ]

  const idMap = new Map<string, string>()
  idMap.set(collectionId, workspaceId)

  const childCollections = allCols
    .filter((c) => c.parent_id === collectionId || isDescendant(c.id, collectionId, allCols))
    .sort((a, b) => a.sort_order - b.sort_order)

  for (const folder of childCollections) {
    const insomniaId = uuidv4()
    idMap.set(folder.id, insomniaId)
    const parentKey = folder.parent_id === collectionId ? workspaceId : idMap.get(folder.parent_id || '') || workspaceId
    resources.push({
      _id: insomniaId,
      _type: 'request_group',
      parentId: parentKey,
      name: folder.name,
      metaSortKey: folder.sort_order
    })
  }

  const collectionIds = new Set([collectionId, ...childCollections.map((c) => c.id)])
  const requests = allReqs.filter((r) => r.collection_id && collectionIds.has(r.collection_id))

  for (const row of requests) {
    const req = rowToRequest(row)
    const parentId = req.collectionId === collectionId ? workspaceId : idMap.get(req.collectionId || '') || workspaceId
    resources.push(buildInsomniaRequest(req, parentId))
  }

  const variables = maskSecretKeyValues(JSON.parse(col?.variables_json || '[]'))
  for (const v of variables) {
    if (!v.key) continue
    resources.push({
      _id: uuidv4(),
      _type: 'environment',
      parentId: workspaceId,
      name: 'Collection Variables',
      data: { [v.key]: maskSecretValue(v) },
      dataPropertyOrder: { '&': [v.key] }
    })
  }

  writeFileSync(filePath, JSON.stringify({ resources }, null, 2), 'utf-8')
}

function isDescendant(
  id: string,
  ancestorId: string,
  allCols: { id: string; parent_id: string | null }[]
): boolean {
  let current = allCols.find((c) => c.id === id)
  while (current?.parent_id) {
    if (current.parent_id === ancestorId) return true
    current = allCols.find((c) => c.id === current!.parent_id)
  }
  return false
}

function buildInsomniaRequest(req: RequestModel, parentId: string) {
  const headers = maskSecretKeyValues(req.headers)
  const params = maskSecretKeyValues(req.params)

  return {
    _id: uuidv4(),
    _type: 'request',
    parentId,
    name: req.name,
    method: req.method,
    url: req.url,
    headers: headers
      .filter((h) => h.key)
      .map((h) => ({ name: h.key, value: maskSecretValue(h), disabled: !h.enabled })),
    parameters: params
      .filter((p) => p.key)
      .map((p) => ({ name: p.key, value: maskSecretValue(p), disabled: !p.enabled })),
    body:
      req.bodyType === 'raw' && req.bodyRaw
        ? { mimeType: req.bodyRawContentType || 'application/json', text: req.bodyRaw }
        : undefined,
    preRequestScript: req.preRequestScript || undefined,
    tests: req.testScript || undefined
  }
}
