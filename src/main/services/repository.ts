import { existsSync } from 'fs'
import { join } from 'path'
import { getAll, getOne, runQuery } from '../db'
import { v4 as uuidv4 } from 'uuid'
import { importProtoFile } from './grpc.service'
import type {
  CollectionModel,
  EnvironmentModel,
  HistoryModel,
  HttpResponse,
  KeyValue,
  RequestModel,
  TestResult
} from '../../../shared/types'

type RequestRow = {
  id: string
  collection_id: string | null
  name: string
  method: string
  url: string
  headers_json: string
  params_json: string
  body_type: string
  body_json: string
  auth_type: string
  auth_json: string
  pre_request_script: string
  test_script: string
  protocol: string
  graphql_query: string
  graphql_variables: string
  ws_url: string
  ws_messages_json: string
  grpc_target: string
  grpc_service: string
  grpc_method: string
  grpc_call_type: string
  grpc_proto_id: string | null
  grpc_metadata_json: string
  grpc_message_json: string
  sort_order: number
  pinned?: number
  created_at: number
  updated_at: number
  last_response_json?: string | null
  last_test_results_json?: string | null
}

function nextCollectionSortOrder(parentId: string | null): number {
  const rows = parentId
    ? getAll<{ sort_order: number }>('SELECT sort_order FROM collections WHERE parent_id = ?', [parentId])
    : getAll<{ sort_order: number }>('SELECT sort_order FROM collections WHERE parent_id IS NULL')
  if (rows.length === 0) return 0
  return Math.min(...rows.map((r) => r.sort_order)) - 1
}

function nextRequestSortOrder(collectionId: string | null): number {
  const rows = collectionId
    ? getAll<{ sort_order: number }>('SELECT sort_order FROM requests WHERE collection_id = ?', [collectionId])
    : getAll<{ sort_order: number }>('SELECT sort_order FROM requests WHERE collection_id IS NULL')
  if (rows.length === 0) return 0
  return Math.min(...rows.map((r) => r.sort_order)) - 1
}

export function rowToRequest(row: RequestRow): RequestModel {
  const body = JSON.parse(row.body_json || '{}')
  return {
    id: row.id,
    collectionId: row.collection_id,
    name: row.name,
    method: row.method as RequestModel['method'],
    url: row.url,
    headers: JSON.parse(row.headers_json),
    params: JSON.parse(row.params_json),
    bodyType: row.body_type as RequestModel['bodyType'],
    bodyRaw: body.raw || '',
    bodyRawContentType: body.rawContentType || 'application/json',
    formData: body.formData || [],
    urlEncoded: body.urlEncoded || [],
    authType: row.auth_type as RequestModel['authType'],
    auth: JSON.parse(row.auth_json),
    preRequestScript: row.pre_request_script,
    testScript: row.test_script,
    protocol: row.protocol as RequestModel['protocol'],
    graphqlQuery: row.graphql_query,
    graphqlVariables: row.graphql_variables,
    wsUrl: row.ws_url,
    wsMessages: JSON.parse(row.ws_messages_json),
    grpcTarget: row.grpc_target,
    grpcService: row.grpc_service,
    grpcMethod: row.grpc_method,
    grpcCallType: row.grpc_call_type as RequestModel['grpcCallType'],
    grpcProtoId: row.grpc_proto_id,
    grpcMetadata: JSON.parse(row.grpc_metadata_json),
    grpcMessage: row.grpc_message_json,
    sortOrder: row.sort_order,
    pinned: Boolean(row.pinned ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastResponse: row.last_response_json ? JSON.parse(row.last_response_json) : null,
    lastTestResults: row.last_test_results_json ? JSON.parse(row.last_test_results_json) : []
  }
}

export function requestToRow(req: RequestModel) {
  return {
    id: req.id,
    collection_id: req.collectionId,
    name: req.name,
    method: req.method,
    url: req.url,
    headers_json: JSON.stringify(req.headers),
    params_json: JSON.stringify(req.params),
    body_type: req.bodyType,
    body_json: JSON.stringify({
      raw: req.bodyRaw,
      rawContentType: req.bodyRawContentType,
      formData: req.formData,
      urlEncoded: req.urlEncoded
    }),
    auth_type: req.authType,
    auth_json: JSON.stringify(req.auth),
    pre_request_script: req.preRequestScript,
    test_script: req.testScript,
    protocol: req.protocol,
    graphql_query: req.graphqlQuery,
    graphql_variables: req.graphqlVariables,
    ws_url: req.wsUrl,
    ws_messages_json: JSON.stringify(req.wsMessages),
    grpc_target: req.grpcTarget,
    grpc_service: req.grpcService,
    grpc_method: req.grpcMethod,
    grpc_call_type: req.grpcCallType,
    grpc_proto_id: req.grpcProtoId,
    grpc_metadata_json: JSON.stringify(req.grpcMetadata),
    grpc_message_json: req.grpcMessage,
    sort_order: req.sortOrder,
    pinned: req.pinned ? 1 : 0,
    created_at: req.createdAt,
    updated_at: req.updatedAt
  }
}

export function listCollections(): CollectionModel[] {
  const rows = getAll<{
    id: string
    name: string
    parent_id: string | null
    sort_order: number
    pinned?: number
    variables_json: string
    created_at: number
  }>('SELECT * FROM collections ORDER BY pinned DESC, sort_order')
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    parentId: r.parent_id,
    sortOrder: r.sort_order,
    pinned: Boolean(r.pinned ?? 0),
    variables: JSON.parse(r.variables_json),
    createdAt: r.created_at
  }))
}

export function createCollection(data: Partial<CollectionModel>): CollectionModel {
  const id = data.id || uuidv4()
  const now = Date.now()
  const parentId = data.parentId ?? null
  const sortOrder = data.sortOrder ?? nextCollectionSortOrder(parentId)
  const pinned = data.pinned ?? false
  runQuery(
    'INSERT INTO collections (id, name, parent_id, sort_order, pinned, variables_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, data.name || 'New Collection', parentId, sortOrder, pinned ? 1 : 0, JSON.stringify(data.variables || []), now]
  )
  return {
    id,
    name: data.name || 'New Collection',
    parentId,
    sortOrder,
    pinned,
    variables: data.variables || [],
    createdAt: now
  }
}

export function updateCollection(id: string, data: Partial<CollectionModel>): CollectionModel {
  const existing = getOne<{
    id: string
    name: string
    parent_id: string | null
    sort_order: number
    pinned?: number
    variables_json: string
    created_at: number
  }>('SELECT * FROM collections WHERE id = ?', [id])!
  const name = data.name ?? existing.name
  const parentId = data.parentId !== undefined ? data.parentId : existing.parent_id
  const sortOrder = data.sortOrder ?? existing.sort_order
  const pinned = data.pinned !== undefined ? data.pinned : Boolean(existing.pinned ?? 0)
  const variablesJson = data.variables !== undefined ? JSON.stringify(data.variables) : existing.variables_json
  runQuery('UPDATE collections SET name = ?, parent_id = ?, sort_order = ?, pinned = ?, variables_json = ? WHERE id = ?', [
    name, parentId, sortOrder, pinned ? 1 : 0, variablesJson, id
  ])
  return {
    id,
    name,
    parentId,
    sortOrder,
    pinned,
    variables: JSON.parse(variablesJson),
    createdAt: existing.created_at
  }
}

export function deleteCollection(id: string) {
  const children = getAll<{ id: string }>('SELECT id FROM collections WHERE parent_id = ?', [id])
  for (const child of children) {
    deleteCollection(child.id)
  }
  runQuery('DELETE FROM requests WHERE collection_id = ?', [id])
  runQuery('DELETE FROM collections WHERE id = ?', [id])
}

export function listRequests(collectionId?: string | null): RequestModel[] {
  const rows = collectionId
    ? getAll<RequestRow>('SELECT * FROM requests WHERE collection_id = ? ORDER BY pinned DESC, sort_order', [collectionId])
    : getAll<RequestRow>('SELECT * FROM requests ORDER BY pinned DESC, sort_order')
  return rows.map((row) => {
    const { lastResponse, lastTestResults, ...req } = rowToRequest(row)
    return req
  })
}

export function getRequest(id: string): RequestModel | null {
  const row = getOne<RequestRow>('SELECT * FROM requests WHERE id = ?', [id])
  return row ? rowToRequest(row) : null
}

export function saveRequest(data: Partial<RequestModel> & { id?: string }): RequestModel {
  const now = Date.now()
  const existing = data.id ? getRequest(data.id) : null
  const collectionId = data.collectionId ?? existing?.collectionId ?? null
  const sortOrder =
    data.sortOrder ?? existing?.sortOrder ?? (existing ? 0 : nextRequestSortOrder(collectionId))
  const pinned = data.pinned ?? existing?.pinned ?? false

  const req: RequestModel = {
    id: data.id || uuidv4(),
    collectionId,
    name: data.name ?? existing?.name ?? 'Untitled Request',
    method: data.method ?? existing?.method ?? 'GET',
    url: data.url ?? existing?.url ?? '',
    headers: data.headers ?? existing?.headers ?? [],
    params: data.params ?? existing?.params ?? [],
    bodyType: data.bodyType ?? existing?.bodyType ?? 'none',
    bodyRaw: data.bodyRaw ?? existing?.bodyRaw ?? '',
    bodyRawContentType: data.bodyRawContentType ?? existing?.bodyRawContentType ?? 'application/json',
    formData: data.formData ?? existing?.formData ?? [],
    urlEncoded: data.urlEncoded ?? existing?.urlEncoded ?? [],
    authType: data.authType ?? existing?.authType ?? 'none',
    auth: data.auth ?? existing?.auth ?? {},
    preRequestScript: data.preRequestScript ?? existing?.preRequestScript ?? '',
    testScript: data.testScript ?? existing?.testScript ?? '',
    protocol: data.protocol ?? existing?.protocol ?? 'http',
    graphqlQuery: data.graphqlQuery ?? existing?.graphqlQuery ?? '',
    graphqlVariables: data.graphqlVariables ?? existing?.graphqlVariables ?? '{}',
    wsUrl: data.wsUrl ?? existing?.wsUrl ?? '',
    wsMessages: data.wsMessages ?? existing?.wsMessages ?? [],
    grpcTarget: data.grpcTarget ?? existing?.grpcTarget ?? '',
    grpcService: data.grpcService ?? existing?.grpcService ?? '',
    grpcMethod: data.grpcMethod ?? existing?.grpcMethod ?? '',
    grpcCallType: data.grpcCallType ?? existing?.grpcCallType ?? 'unary',
    grpcProtoId: data.grpcProtoId ?? existing?.grpcProtoId ?? null,
    grpcMetadata: data.grpcMetadata ?? existing?.grpcMetadata ?? [],
    grpcMessage: data.grpcMessage ?? existing?.grpcMessage ?? '{}',
    sortOrder,
    pinned,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  }

  const row = requestToRow(req)
  if (existing) {
    runQuery(
      `UPDATE requests SET collection_id=?, name=?, method=?, url=?, headers_json=?, params_json=?, body_type=?, body_json=?,
       auth_type=?, auth_json=?, pre_request_script=?, test_script=?, protocol=?, graphql_query=?, graphql_variables=?,
       ws_url=?, ws_messages_json=?, grpc_target=?, grpc_service=?, grpc_method=?, grpc_call_type=?, grpc_proto_id=?,
       grpc_metadata_json=?, grpc_message_json=?, sort_order=?, pinned=?, updated_at=? WHERE id=?`,
      [
        row.collection_id, row.name, row.method, row.url, row.headers_json, row.params_json, row.body_type, row.body_json,
        row.auth_type, row.auth_json, row.pre_request_script, row.test_script, row.protocol, row.graphql_query,
        row.graphql_variables, row.ws_url, row.ws_messages_json, row.grpc_target, row.grpc_service, row.grpc_method,
        row.grpc_call_type, row.grpc_proto_id, row.grpc_metadata_json, row.grpc_message_json, row.sort_order, row.pinned, row.updated_at, row.id
      ]
    )
  } else {
    runQuery(
      `INSERT INTO requests (id, collection_id, name, method, url, headers_json, params_json, body_type, body_json,
       auth_type, auth_json, pre_request_script, test_script, protocol, graphql_query, graphql_variables,
       ws_url, ws_messages_json, grpc_target, grpc_service, grpc_method, grpc_call_type, grpc_proto_id,
       grpc_metadata_json, grpc_message_json, sort_order, pinned, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        row.id, row.collection_id, row.name, row.method, row.url, row.headers_json, row.params_json, row.body_type,
        row.body_json, row.auth_type, row.auth_json, row.pre_request_script, row.test_script, row.protocol,
        row.graphql_query, row.graphql_variables, row.ws_url, row.ws_messages_json, row.grpc_target, row.grpc_service,
        row.grpc_method, row.grpc_call_type, row.grpc_proto_id, row.grpc_metadata_json, row.grpc_message_json,
        row.sort_order, row.pinned, row.created_at, row.updated_at
      ]
    )
  }
  return req
}

export function deleteRequest(id: string) {
  runQuery('DELETE FROM requests WHERE id = ?', [id])
}

function sortRequestsByDisplay(a: RequestModel, b: RequestModel) {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
  return a.sortOrder - b.sortOrder
}

function listRequestsInCollection(collectionId: string | null, excludeId?: string): RequestModel[] {
  return listRequests()
    .filter((r) => r.collectionId === collectionId && r.id !== excludeId)
    .sort(sortRequestsByDisplay)
}

/** Move a request within or across collections; insert before `beforeRequestId` or append when null. */
export function moveRequest(
  requestId: string,
  targetCollectionId: string | null,
  beforeRequestId: string | null
): RequestModel {
  const moving = getRequest(requestId)
  if (!moving) throw new Error('Request not found')

  const sourceCollectionId = moving.collectionId
  const targetList = listRequestsInCollection(targetCollectionId, requestId)

  let insertAt = targetList.length
  if (beforeRequestId) {
    const idx = targetList.findIndex((r) => r.id === beforeRequestId)
    if (idx >= 0) insertAt = idx
  }

  const orderedIds = targetList.map((r) => r.id)
  orderedIds.splice(insertAt, 0, requestId)

  let moved: RequestModel = moving
  orderedIds.forEach((id, sortOrder) => {
    if (id === requestId) {
      moved = saveRequest({ id, collectionId: targetCollectionId, sortOrder })
    } else {
      saveRequest({ id, sortOrder })
    }
  })

  if (sourceCollectionId !== targetCollectionId) {
    listRequestsInCollection(sourceCollectionId).forEach((r, sortOrder) => {
      saveRequest({ id: r.id, sortOrder })
    })
  }

  return moved
}

export function saveRequestLastResponse(id: string, response: HttpResponse, testResults: TestResult[] = []) {
  runQuery(
    'UPDATE requests SET last_response_json = ?, last_test_results_json = ?, updated_at = ? WHERE id = ?',
    [JSON.stringify(response), JSON.stringify(testResults), Date.now(), id]
  )
}

export function listEnvironments(): EnvironmentModel[] {
  const rows = getAll<{
    id: string
    name: string
    is_active: number
    variables_json: string
    created_at: number
  }>('SELECT * FROM environments')
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    isActive: !!r.is_active,
    variables: JSON.parse(r.variables_json),
    createdAt: r.created_at
  }))
}

export function saveEnvironment(data: Partial<EnvironmentModel> & { id?: string }): EnvironmentModel {
  const id = data.id || uuidv4()
  const existing = data.id
    ? getOne<{ created_at: number; is_active: number }>(
        'SELECT created_at, is_active FROM environments WHERE id = ?',
        [id]
      )
    : undefined
  const now = Date.now()
  const name = data.name ?? (existing ? listEnvironments().find((e) => e.id === id)?.name : undefined) ?? 'New Environment'
  const isActive =
    data.isActive !== undefined ? (data.isActive ? 1 : 0) : (existing?.is_active ?? 0)
  const variables =
    data.variables ??
    (existing ? listEnvironments().find((e) => e.id === id)?.variables : undefined) ??
    []
  const variablesJson = JSON.stringify(variables)
  const createdAt = existing?.created_at ?? now

  if (existing) {
    runQuery('UPDATE environments SET name=?, is_active=?, variables_json=? WHERE id=?', [name, isActive, variablesJson, id])
  } else {
    runQuery('INSERT INTO environments (id, name, is_active, variables_json, created_at) VALUES (?,?,?,?,?)', [
      id, name, isActive, variablesJson, createdAt
    ])
  }

  return { id, name, isActive: !!isActive, variables, createdAt }
}

export function deleteEnvironment(id: string) {
  runQuery('DELETE FROM environments WHERE id = ?', [id])
}

export function setActiveEnvironment(id: string | null) {
  runQuery('UPDATE environments SET is_active = 0')
  if (id) runQuery('UPDATE environments SET is_active = 1 WHERE id = ?', [id])
}

export function getActiveEnvironment(): EnvironmentModel | null {
  return listEnvironments().find((e) => e.isActive) || null
}

export function listHistory(limit = 100): HistoryModel[] {
  const rows = getAll<{
    id: string
    request_id: string | null
    method: string
    url: string
    status_code: number
    duration_ms: number
    request_snapshot_json: string
    response_snapshot_json: string
    sent_at: number
  }>('SELECT * FROM history ORDER BY sent_at DESC LIMIT ?', [limit])
  return rows.map((r) => ({
    id: r.id,
    requestId: r.request_id,
    method: r.method,
    url: r.url,
    statusCode: r.status_code,
    durationMs: r.duration_ms,
    requestSnapshot: JSON.parse(r.request_snapshot_json),
    responseSnapshot: JSON.parse(r.response_snapshot_json),
    sentAt: r.sent_at
  }))
}

export function addHistory(requestSnapshot: RequestModel, responseSnapshot: HttpResponse, requestId?: string | null) {
  runQuery(
    'INSERT INTO history (id, request_id, method, url, status_code, duration_ms, request_snapshot_json, response_snapshot_json, sent_at) VALUES (?,?,?,?,?,?,?,?,?)',
    [
      uuidv4(),
      requestId ?? null,
      requestSnapshot.method,
      requestSnapshot.url,
      responseSnapshot.statusCode,
      responseSnapshot.durationMs,
      JSON.stringify(requestSnapshot),
      JSON.stringify(responseSnapshot),
      Date.now()
    ]
  )
}

export function clearHistory() {
  runQuery('DELETE FROM history')
}

export function seedFreshInstall() {
  const env = saveEnvironment({
    name: 'Local',
    isActive: true,
    variables: [
      { id: uuidv4(), key: 'baseUrl', value: 'http://localhost:8080', enabled: true }
    ]
  })
  setActiveEnvironment(env.id)
  createCollection({ name: 'My Collection' })
}

function demoResponse(
  statusCode: number,
  statusText: string,
  body: unknown,
  durationMs: number
): HttpResponse {
  const text = typeof body === 'string' ? body : JSON.stringify(body, null, 2)
  return {
    statusCode,
    statusText,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: text,
    durationMs,
    sizeBytes: new TextEncoder().encode(text).length,
    cookies: []
  }
}

/** Rich demo data for automated marketing screenshots (see tests/e2e/screenshots.spec.mjs). */
export function seedScreenshotDemo() {
  runQuery('DELETE FROM history')
  runQuery('DELETE FROM requests')
  runQuery('DELETE FROM collections')
  runQuery('DELETE FROM environments')
  runQuery('DELETE FROM proto_files')

  saveEnvironment({
    name: 'Local Dev',
    isActive: false,
    variables: [
      { id: uuidv4(), key: 'baseUrl', value: 'http://localhost:8080', enabled: true },
      { id: uuidv4(), key: 'apiKey', value: 'dev-key', enabled: true }
    ]
  })

  const env = saveEnvironment({
    name: 'Production',
    isActive: true,
    variables: [
      { id: uuidv4(), key: 'baseUrl', value: 'https://jsonplaceholder.typicode.com', enabled: true },
      { id: uuidv4(), key: 'userId', value: '1', enabled: true },
      { id: uuidv4(), key: 'token', value: 'demo-bearer-token', enabled: true }
    ]
  })
  setActiveEnvironment(env.id)

  const demoApi = createCollection({
    name: 'Demo API',
    variables: [{ id: uuidv4(), key: 'apiVersion', value: 'v1', enabled: true }]
  })
  const usersFolder = createCollection({ name: 'Users', parentId: demoApi.id })

  const listUsers = saveRequest({
    collectionId: usersFolder.id,
    name: 'List Users',
    method: 'GET',
    url: '{{baseUrl}}/users',
    pinned: true,
    preRequestScript: 'pm.environment.set("requestedAt", Date.now());',
    testScript: `pm.test("Status is 200", () => {
  pm.response.to.have.status(200);
});

pm.test("Returns an array", () => {
  pm.expect(pm.response.json()).to.be.an("array");
});`,
    sortOrder: 0
  })

  const listUsersResponse = demoResponse(
    200,
    'OK',
    [
      { id: 1, name: 'Alice Chen', email: 'alice@example.com' },
      { id: 2, name: 'Bob Smith', email: 'bob@example.com' },
      { id: 3, name: 'Carol Jones', email: 'carol@example.com' }
    ],
    142
  )
  saveRequestLastResponse(listUsers.id, listUsersResponse)
  addHistory(listUsers, listUsersResponse, listUsers.id)

  saveRequest({
    collectionId: usersFolder.id,
    name: 'Delete User',
    method: 'DELETE',
    url: '{{baseUrl}}/users/{{userId}}',
    params: [{ id: uuidv4(), key: 'force', value: 'true', enabled: true }],
    sortOrder: 1
  })

  saveRequest({
    collectionId: demoApi.id,
    name: 'GraphQL Products',
    method: 'POST',
    url: '{{baseUrl}}/graphql',
    protocol: 'graphql',
    graphqlQuery: `query Products($limit: Int!) {
  products(limit: $limit) {
    id
    title
    price
  }
}`,
    graphqlVariables: '{\n  "limit": 10\n}',
    sortOrder: 1
  })

  saveRequest({
    collectionId: demoApi.id,
    name: 'Live Chat WS',
    method: 'GET',
    url: 'wss://echo.websocket.events',
    protocol: 'websocket',
    wsUrl: 'wss://echo.websocket.events',
    sortOrder: 2
  })

  let grpcProtoId: string | null = null
  const protoPath = join(process.cwd(), 'tests/fixtures/user.proto')
  if (existsSync(protoPath)) {
    try {
      grpcProtoId = importProtoFile(protoPath).protoId
    } catch {
      grpcProtoId = null
    }
  }

  saveRequest({
    collectionId: demoApi.id,
    name: 'gRPC GetUser',
    method: 'POST',
    url: '',
    protocol: 'grpc',
    grpcTarget: 'localhost:50051',
    grpcService: 'user.UserService',
    grpcMethod: 'GetUser',
    grpcProtoId,
    grpcMessage: '{\n  "id": 1\n}',
    sortOrder: 3
  })
}

export function createEmptyRequest(collectionId: string | null = null): RequestModel {
  const now = Date.now()
  return {
    id: uuidv4(),
    collectionId,
    name: 'New Request',
    method: 'GET',
    url: '',
    headers: [],
    params: [],
    bodyType: 'none',
    bodyRaw: '',
    bodyRawContentType: 'application/json',
    formData: [],
    urlEncoded: [],
    authType: 'none',
    auth: {},
    preRequestScript: '',
    testScript: '',
    protocol: 'http',
    graphqlQuery: '',
    graphqlVariables: '{}',
    wsUrl: '',
    wsMessages: [],
    grpcTarget: '',
    grpcService: '',
    grpcMethod: '',
    grpcCallType: 'unary',
    grpcProtoId: null,
    grpcMetadata: [],
    grpcMessage: '{}',
    sortOrder: 0,
    pinned: false,
    createdAt: now,
    updatedAt: now
  }
}
