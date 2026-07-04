export type Protocol = 'http' | 'graphql' | 'websocket' | 'grpc'
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
  wsUrl: string
  wsMessages: WsMessage[]
  grpcTarget: string
  grpcService: string
  grpcMethod: string
  grpcCallType: GrpcCallType
  grpcProtoId: string | null
  grpcMetadata: KeyValue[]
  grpcMessage: string
  sortOrder: number
  pinned: boolean
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
  durationMs: number
  sizeBytes: number
  cookies: KeyValue[]
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
}

export interface AppInfo {
  name: string
  description: string
  version: string
  author: string
  email: string
  website: string
}

export interface FluxAPI {
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
    curl: (curlString: string, collectionId?: string | null) => Promise<RequestModel>
  }
  export: {
    postman: (collectionId: string, filePath: string) => Promise<void>
    openapi: (collectionId: string, filePath: string) => Promise<void>
    curl: (requestId: string) => Promise<string>
  }
  openapi: {
    list: () => Promise<OpenApiSpecModel[]>
    get: (id: string) => Promise<OpenApiSpecModel | null>
    delete: (id: string) => Promise<void>
    getPaths: (specId: string) => Promise<OpenApiPathItem[]>
    generateRequest: (specId: string, path: string, method: string, collectionId?: string | null) => Promise<RequestModel>
  }
  cookies: {
    list: () => Promise<CookieRecord[]>
    clearAll: () => Promise<void>
    clearDomain: (domain: string) => Promise<void>
  }
  runner: {
    runCollection: (collectionId: string, stopOnFailure?: boolean) => Promise<CollectionRunResult[]>
  }
  ws: {
    connect: (url: string, headers: KeyValue[]) => Promise<string>
    send: (connectionId: string, data: string) => Promise<void>
    disconnect: (connectionId: string) => Promise<void>
    onMessage: (callback: (connectionId: string, message: WsMessage) => void) => () => void
  }
  graphql: {
    introspect: (url: string, headers?: KeyValue[]) => Promise<unknown>
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
    import: (filePath: string) => Promise<ProtoFileModel>
    delete: (id: string) => Promise<void>
  }
  settings: {
    get: () => Promise<Settings>
    set: (settings: Partial<Settings>) => Promise<Settings>
  }
  dialog: {
    openFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>
    saveFile: (defaultPath?: string, filters?: { name: string; extensions: string[] }[]) => Promise<string | null>
  }
  fs: {
    writeTextFile: (filePath: string, content: string) => Promise<void>
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
    fluxAPI: FluxAPI
  }
}

export {}
