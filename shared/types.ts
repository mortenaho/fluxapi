export type Protocol = 'http' | 'graphql' | 'websocket' | 'grpc' | 'sse'
export type GraphQLOperationType = 'query' | 'subscription'
export type DataFileFormat = 'csv' | 'json'
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
export type BodyType = 'none' | 'raw' | 'form-data' | 'x-www-form-urlencoded'
export type AuthType = 'none' | 'bearer' | 'basic' | 'apikey' | 'oauth2'
export type OAuthGrantType = 'client_credentials' | 'password'
export type GrpcCallType = 'unary' | 'server_streaming' | 'client_streaming' | 'bidi_streaming'

export interface KeyValue {
  id: string
  key: string
  value: string
  enabled: boolean
  filePath?: string
  secret?: boolean
}

export interface AuthConfig {
  bearerToken?: string
  basicUsername?: string
  basicPassword?: string
  apiKeyKey?: string
  apiKeyValue?: string
  apiKeyIn?: 'header' | 'query'
  oauthGrantType?: OAuthGrantType
  oauthTokenUrl?: string
  oauthClientId?: string
  oauthClientSecret?: string
  oauthUsername?: string
  oauthPassword?: string
  oauthScope?: string
  oauthAccessToken?: string
}

export interface CookieRecord {
  name: string
  value: string
  domain: string
  path: string
  secure: boolean
  httpOnly: boolean
  hostOnly: boolean
  expires?: number
}

export interface OpenApiPathItem {
  path: string
  method: string
  summary: string
  operationId?: string
}

export interface CollectionRunResult {
  requestId: string
  requestName: string
  statusCode: number
  passed: boolean
  error?: string
  durationMs: number
  iteration?: number
  dataRow?: number
}

export interface CollectionRunOptions {
  stopOnFailure?: boolean
  iterations?: number
  delayMs?: number
  dataFilePath?: string
  dataFileFormat?: DataFileFormat
}

export interface CollectionRunReport {
  collectionId: string
  collectionName: string
  startedAt: number
  finishedAt: number
  iterations: number
  delayMs: number
  results: CollectionRunResult[]
  passed: number
  failed: number
}

export interface WorkspaceBackup {
  version: 1
  exportedAt: number
  collections: CollectionModel[]
  requests: RequestModel[]
  environments: EnvironmentModel[]
  openapiSpecs: OpenApiSpecModel[]
  protoFiles: ProtoFileModel[]
}

export interface RequestModel {
  id: string
  collectionId: string | null
  name: string
  method: HttpMethod
  url: string
  headers: KeyValue[]
  params: KeyValue[]
  bodyType: BodyType
  bodyRaw: string
  bodyRawContentType: string
  formData: KeyValue[]
  urlEncoded: KeyValue[]
  authType: AuthType
  auth: AuthConfig
  preRequestScript: string
  testScript: string
  protocol: Protocol
  graphqlQuery: string
  graphqlVariables: string
  graphqlOperationType?: GraphQLOperationType
  wsUrl: string
  wsMessages: WsMessage[]
  sseUrl: string
  sseMessages: SseMessage[]
  grpcTarget: string
  grpcService: string
  grpcMethod: string
  grpcCallType: GrpcCallType
  grpcProtoId: string | null
  grpcMetadata: KeyValue[]
  grpcMessage: string
  sortOrder: number
  pinned: boolean
  tags?: string[]
  notes?: string
  createdAt: number
  updatedAt: number
  lastResponse?: HttpResponse | null
  lastTestResults?: TestResult[]
}

export interface CollectionModel {
  id: string
  name: string
  parentId: string | null
  sortOrder: number
  pinned: boolean
  variables: KeyValue[]
  description?: string
  syncPath?: string
  createdAt: number
}

export interface EnvironmentModel {
  id: string
  name: string
  isActive: boolean
  variables: KeyValue[]
  createdAt: number
}

export interface HistoryModel {
  id: string
  requestId: string | null
  method: string
  url: string
  statusCode: number
  durationMs: number
  requestSnapshot: RequestModel
  responseSnapshot: HttpResponse
  sentAt: number
}

export interface HttpResponse {
  statusCode: number
  statusText: string
  headers: Record<string, string>
  body: string
  bodyEncoding?: 'text' | 'base64'
  durationMs: number
  sizeBytes: number
  cookies: KeyValue[]
}

export interface ScheduledJobModel {
  id: string
  requestId: string
  scheduleExpr: string
  enabled: boolean
  notify: boolean
  lastRunAt?: number
  createdAt: number
}

export interface HttpRequestPayload {
  requestId?: string
  method: HttpMethod
  url: string
  headers: KeyValue[]
  params: KeyValue[]
  bodyType: BodyType
  bodyRaw: string
  bodyRawContentType: string
  formData: KeyValue[]
  urlEncoded: KeyValue[]
  authType: AuthType
  auth: AuthConfig
  preRequestScript?: string
  testScript?: string
  environmentId?: string | null
  collectionId?: string | null
  collectionVariables?: KeyValue[]
  sslVerify?: boolean
  timeoutMs?: number
  followRedirects?: boolean
}

export interface TestResult {
  name: string
  passed: boolean
  error?: string
}

export interface SendResult {
  response: HttpResponse
  testResults: TestResult[]
  environmentChanges: KeyValue[]
  scriptLogs: string[]
}

export interface WsMessage {
  id: string
  direction: 'sent' | 'received'
  data: string
  timestamp: number
}

export interface SseMessage {
  id: string
  event?: string
  data: string
  timestamp: number
}

export type MockResponseType = 'json' | 'text' | 'file'

export type MockFileDisposition = 'auto' | 'inline' | 'attachment'

export interface MockRoute {
  id: string
  method: string
  path: string
  statusCode: number
  body: string
  responseType?: MockResponseType
  filePath?: string
  fileDisposition?: MockFileDisposition
  contentType?: string
  headers: Record<string, string>
}

export interface MockServerState {
  running: boolean
  port: number
  baseUrl: string
  routes: MockRoute[]
}

export interface GrpcReflectionResult {
  target: string
  services: GrpcServiceInfo[]
  reflectedAt: number
}

export interface ProtoFileModel {
  id: string
  name: string
  filePath: string
  content: string
  importedAt: number
}

export interface GrpcMethodInfo {
  name: string
  callType: GrpcCallType
}

export interface GrpcServiceInfo {
  name: string
  methods: GrpcMethodInfo[]
}

export interface OpenApiSpecModel {
  id: string
  name: string
  filePath: string
  format: 'openapi3' | 'swagger2'
  content: string
  title: string
  version: string
  servers: string[]
  importedAt: number
}

export interface Settings {
  sslVerify: boolean
  timeoutMs: number
  followRedirects: boolean
  theme: 'light' | 'dark'
  proxyUrl?: string
  runnerIterations?: number
  runnerDelayMs?: number
  autoUpdate?: boolean
}

export interface AppInfo {
  name: string
  description: string
  version: string
  author: string
  email: string
  website: string
}

export interface LisekAPI {
  request: {
    send: (payload: HttpRequestPayload) => Promise<SendResult>
    cancel: (id: string) => Promise<void>
  }
  collections: {
    list: () => Promise<CollectionModel[]>
    create: (data: Partial<CollectionModel>) => Promise<CollectionModel>
    update: (id: string, data: Partial<CollectionModel>) => Promise<CollectionModel>
    delete: (id: string) => Promise<void>
  }
  requests: {
    list: (collectionId?: string | null) => Promise<RequestModel[]>
    get: (id: string) => Promise<RequestModel | null>
    save: (data: Partial<RequestModel> & { id?: string }) => Promise<RequestModel>
    delete: (id: string) => Promise<void>
    move: (
      requestId: string,
      targetCollectionId: string | null,
      beforeRequestId: string | null
    ) => Promise<RequestModel>
  }
  environments: {
    list: () => Promise<EnvironmentModel[]>
    save: (data: Partial<EnvironmentModel> & { id?: string }) => Promise<EnvironmentModel>
    delete: (id: string) => Promise<void>
    setActive: (id: string | null) => Promise<void>
  }
  history: {
    list: (limit?: number) => Promise<HistoryModel[]>
    clear: () => Promise<void>
  }
  import: {
    postman: (filePath: string) => Promise<{ collectionId: string; count: number }>
    postmanFromUrl: (url: string) => Promise<{ collectionId: string; count: number }>
    openapi: (filePath: string) => Promise<{ collectionId: string; specId: string; count: number }>
    openapiFromUrl: (url: string) => Promise<{ collectionId: string; specId: string; count: number }>
    insomnia: (filePath: string) => Promise<{ collectionId: string; count: number }>
    insomniaFromUrl: (url: string) => Promise<{ collectionId: string; count: number }>
    har: (filePath: string, collectionId?: string | null) => Promise<{ collectionId: string; count: number }>
    curl: (curlString: string, collectionId?: string | null) => Promise<RequestModel>
    bruno: (folderPath: string, collectionId?: string | null) => Promise<{ collectionId: string; count: number }>
  }
  export: {
    postman: (collectionId: string, filePath: string) => Promise<void>
    openapi: (collectionId: string, filePath: string) => Promise<void>
    insomnia: (collectionId: string, filePath: string) => Promise<void>
    bruno: (collectionId: string, folderPath: string) => Promise<number>
    curl: (requestId: string) => Promise<string>
    har: (historyId: string, filePath: string) => Promise<void>
    harFromRequest: (requestId: string, filePath: string) => Promise<void>
  }
  workspace: {
    export: (filePath: string) => Promise<void>
    import: (filePath: string) => Promise<void>
  }
  openapi: {
    list: () => Promise<OpenApiSpecModel[]>
    get: (id: string) => Promise<OpenApiSpecModel | null>
    delete: (id: string) => Promise<void>
    getPaths: (specId: string) => Promise<OpenApiPathItem[]>
    generateRequest: (specId: string, path: string, method: string, collectionId?: string | null) => Promise<RequestModel>
    createEnvironment: (specId: string, activate?: boolean) => Promise<EnvironmentModel>
  }
  cookies: {
    list: () => Promise<CookieRecord[]>
    clearAll: () => Promise<void>
    clearDomain: (domain: string) => Promise<void>
  }
  runner: {
    runCollection: (collectionId: string, options?: CollectionRunOptions) => Promise<CollectionRunResult[]>
    exportReport: (report: CollectionRunReport, filePath: string, format: 'json' | 'html') => Promise<void>
  }
  ws: {
    connect: (url: string, headers: KeyValue[]) => Promise<string>
    send: (connectionId: string, data: string) => Promise<void>
    disconnect: (connectionId: string) => Promise<void>
    onMessage: (callback: (connectionId: string, message: WsMessage) => void) => () => void
  }
  graphql: {
    introspect: (url: string, headers?: KeyValue[]) => Promise<unknown>
    subscribe: (url: string, query: string, variables: string, headers?: KeyValue[]) => Promise<string>
    unsubscribe: (connectionId: string) => Promise<void>
    onSubscriptionMessage: (callback: (connectionId: string, message: WsMessage) => void) => () => void
  }
  sse: {
    connect: (url: string, headers: KeyValue[]) => Promise<string>
    disconnect: (connectionId: string) => Promise<void>
    onMessage: (callback: (connectionId: string, message: SseMessage) => void) => () => void
  }
  mock: {
    getState: () => Promise<MockServerState>
    start: (port?: number, seedRoute?: Omit<MockRoute, 'id'>, forceRestart?: boolean) => Promise<MockServerState>
    stop: () => Promise<MockServerState>
    addRoute: (route: Omit<MockRoute, 'id'>) => Promise<MockServerState>
    updateRoute: (id: string, route: Omit<MockRoute, 'id'>) => Promise<MockServerState>
    removeRoute: (id: string) => Promise<MockServerState>
    clearRoutes: () => Promise<MockServerState>
  }
  grpc: {
    loadProto: (filePath: string) => Promise<{ protoId: string; services: GrpcServiceInfo[] }>
    getServices: (protoId: string) => Promise<GrpcServiceInfo[]>
    reflect: (target: string) => Promise<GrpcServiceInfo[]>
    invoke: (payload: {
      target: string
      protoId: string
      service: string
      method: string
      callType: GrpcCallType
      metadata: KeyValue[]
      message: string
      messages?: string[]
      sslVerify?: boolean
    }) => Promise<{ messages: unknown[]; metadata: Record<string, string>; status: string }>
    cancel: (callId: string) => Promise<void>
  }
  proto: {
    list: () => Promise<ProtoFileModel[]>
    import: (filePath: string) => Promise<{ protoId: string; services: GrpcServiceInfo[] }>
    importFromUrl: (url: string) => Promise<{ protoId: string; services: GrpcServiceInfo[] }>
    delete: (id: string) => Promise<void>
  }
  sync: {
    exportFolder: (collectionId: string, folderPath: string) => Promise<number>
    importFolder: (folderPath: string, collectionId?: string | null) => Promise<{ collectionId: string; count: number }>
    linkFolder: (collectionId: string, folderPath: string) => Promise<CollectionModel>
    unlinkFolder: (collectionId: string) => Promise<CollectionModel>
    push: (collectionId: string) => Promise<number>
    pull: (collectionId: string) => Promise<{ count: number }>
    startWatch: (collectionId: string) => Promise<void>
    stopWatch: (collectionId: string) => Promise<void>
    listWatched: () => Promise<string[]>
  }
  schedule: {
    list: () => Promise<ScheduledJobModel[]>
    save: (data: Partial<ScheduledJobModel> & { requestId: string; scheduleExpr: string }) => Promise<ScheduledJobModel>
    delete: (id: string) => Promise<void>
    runNow: (id: string) => Promise<void>
  }
  settings: {
    get: () => Promise<Settings>
    set: (settings: Partial<Settings>) => Promise<Settings>
  }
  dialog: {
    openFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>
    openDirectory: () => Promise<string | null>
    saveFile: (defaultPath?: string, filters?: { name: string; extensions: string[] }[]) => Promise<string | null>
  }
  fs: {
    writeTextFile: (filePath: string, content: string) => Promise<void>
    writeBinaryFile: (filePath: string, base64: string) => Promise<void>
  }
  clipboard: {
    writeText: (text: string) => Promise<void>
  }
  app: {
    getInfo: () => Promise<AppInfo>
  }
  shell: {
    openExternal: (url: string) => Promise<void>
  }
}

declare global {
  interface Window {
    lisek: LisekAPI
    /** Used by Playwright screenshot tour (tests/e2e/screenshots.spec.mjs). */
    __lisekStore?: {
      getState: () => {
        selectRequest: (req: RequestModel | null) => Promise<void>
        setActiveSidebar: (tab: 'collections' | 'history' | 'openapi' | 'proto') => void
      }
    }
  }
}

export {}
