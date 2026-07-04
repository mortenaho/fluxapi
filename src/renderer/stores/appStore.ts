import { create } from 'zustand'
import type {
  CollectionModel,
  EnvironmentModel,
  HistoryModel,
  HttpResponse,
  OpenApiSpecModel,
  ProtoFileModel,
  RequestModel,
  Settings,
  TestResult
} from '@shared/types'

interface AppState {
  themeMode: 'light' | 'dark'
  collections: CollectionModel[]
  requests: RequestModel[]
  environments: EnvironmentModel[]
  history: HistoryModel[]
  openapiSpecs: OpenApiSpecModel[]
  protoFiles: ProtoFileModel[]
  activeRequest: RequestModel | null
  activeSidebar: 'collections' | 'history' | 'openapi' | 'proto'
  response: HttpResponse | null
  testResults: TestResult[]
  loading: boolean
  wsConnectionId: string | null
  wsMessages: import('@shared/types').WsMessage[]
  settings: Settings
  snippetOpen: boolean
  importDialogOpen: boolean
  importType: 'postman' | 'openapi' | 'curl' | null
  curlPaste: string
  searchQuery: string

  loadInitial: () => Promise<void>
  setThemeMode: (mode: 'light' | 'dark') => void
  setActiveSidebar: (tab: AppState['activeSidebar']) => void
  setActiveRequest: (req: RequestModel | null) => void
  selectRequest: (req: RequestModel | null) => Promise<void>
  openHistoryItem: (item: HistoryModel) => void
  updateActiveRequest: (partial: Partial<RequestModel>) => void
  loadCollections: () => Promise<void>
  loadRequests: () => Promise<void>
  loadEnvironments: () => Promise<void>
  loadHistory: () => Promise<void>
  loadOpenApiSpecs: () => Promise<void>
  loadProtoFiles: () => Promise<void>
  sendRequest: () => Promise<void>
  persistActiveRequest: () => Promise<RequestModel | null>
  createCollection: (name: string, parentId?: string | null) => Promise<void>
  deleteCollection: (id: string) => Promise<void>
  renameCollection: (id: string, name: string) => Promise<void>
  setCollectionPinned: (id: string, pinned: boolean) => Promise<void>
  createRequest: (collectionId?: string | null) => Promise<void>
  deleteRequest: (id: string) => Promise<void>
  setRequestPinned: (id: string, pinned: boolean) => Promise<void>
  setResponse: (response: HttpResponse | null, testResults?: TestResult[]) => void
  setSnippetOpen: (open: boolean) => void
  setImportDialog: (open: boolean, type?: AppState['importType']) => void
  setCurlPaste: (text: string) => void
  setSearchQuery: (q: string) => void
}

const emptyRequest = (): RequestModel => ({
  id: '',
  collectionId: null,
  name: 'Untitled Request',
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
  createdAt: Date.now(),
  updatedAt: Date.now()
})

export const useAppStore = create<AppState>((set, get) => ({
  themeMode: 'light',
  collections: [],
  requests: [],
  environments: [],
  history: [],
  openapiSpecs: [],
  protoFiles: [],
  activeRequest: emptyRequest(),
  activeSidebar: 'collections',
  response: null,
  testResults: [],
  loading: false,
  wsConnectionId: null,
  wsMessages: [],
  settings: { sslVerify: true, timeoutMs: 30000, followRedirects: true, theme: 'light' },
  snippetOpen: false,
  importDialogOpen: false,
  importType: null,
  curlPaste: '',
  searchQuery: '',

  loadInitial: async () => {
    const settings = await window.fluxAPI.settings.get()
    set({ settings, themeMode: settings.theme })
    await Promise.all([
      get().loadCollections(),
      get().loadRequests(),
      get().loadEnvironments(),
      get().loadHistory(),
      get().loadOpenApiSpecs(),
      get().loadProtoFiles()
    ])
  },

  setThemeMode: async (mode) => {
    await window.fluxAPI.settings.set({ theme: mode })
    set({ themeMode: mode, settings: { ...get().settings, theme: mode } })
  },

  setActiveSidebar: (tab) => set({ activeSidebar: tab }),

  setActiveRequest: (req) => set({ activeRequest: req, response: null, testResults: [] }),

  selectRequest: async (req) => {
    set({ response: null, testResults: [] })

    if (!req) {
      set({ activeRequest: null })
      return
    }

    set({ activeRequest: req })

    if (req.id) {
      const full = await window.fluxAPI.requests.get(req.id)
      if (full && get().activeRequest?.id === full.id) {
        set({
          activeRequest: full,
          response: full.lastResponse ?? null,
          testResults: full.lastTestResults ?? []
        })
      }
    }
  },

  openHistoryItem: (item) => {
    set({
      activeRequest: item.requestSnapshot,
      response: item.responseSnapshot,
      testResults: []
    })
  },

  updateActiveRequest: (partial) => {
    const current = get().activeRequest
    if (!current) return
    set({ activeRequest: { ...current, ...partial } })
  },

  loadCollections: async () => {
    const collections = await window.fluxAPI.collections.list()
    set({ collections })
  },

  loadRequests: async () => {
    const requests = await window.fluxAPI.requests.list()
    set({ requests })
  },

  loadEnvironments: async () => {
    const environments = await window.fluxAPI.environments.list()
    set({ environments })
  },

  loadHistory: async () => {
    const history = await window.fluxAPI.history.list()
    set({ history })
  },

  loadOpenApiSpecs: async () => {
    const openapiSpecs = await window.fluxAPI.openapi.list()
    set({ openapiSpecs })
  },

  loadProtoFiles: async () => {
    const protoFiles = await window.fluxAPI.proto.list()
    set({ protoFiles })
  },

  sendRequest: async () => {
    const saved = await get().persistActiveRequest()
    if (!saved) return

    set({ loading: true, response: null, testResults: [] })

    try {
      if (saved.protocol === 'websocket') {
        const id = await window.fluxAPI.ws.connect(saved.wsUrl || saved.url, saved.headers)
        set({ wsConnectionId: id })
        return
      }

      if (saved.protocol === 'grpc') {
        const result = await window.fluxAPI.grpc.invoke({
          target: saved.grpcTarget,
          protoId: saved.grpcProtoId!,
          service: saved.grpcService,
          method: saved.grpcMethod,
          callType: saved.grpcCallType,
          metadata: saved.grpcMetadata,
          message: saved.grpcMessage,
          sslVerify: get().settings.sslVerify
        })
        set({
          response: {
            statusCode: 200,
            statusText: result.status,
            headers: result.metadata,
            body: JSON.stringify(result.messages, null, 2),
            durationMs: 0,
            sizeBytes: 0,
            cookies: []
          }
        })
        return
      }

      const activeEnv = get().environments.find((e) => e.isActive)
      const collection = get().collections.find((c) => c.id === saved.collectionId)

      const result = await window.fluxAPI.request.send({
        requestId: saved.id,
        method: saved.method,
        url: saved.url,
        headers: saved.headers,
        params: saved.params,
        bodyType: saved.protocol === 'graphql' ? 'raw' : saved.bodyType,
        bodyRaw:
          saved.protocol === 'graphql'
            ? JSON.stringify({ query: saved.graphqlQuery, variables: JSON.parse(saved.graphqlVariables || '{}') })
            : saved.bodyRaw,
        bodyRawContentType: saved.protocol === 'graphql' ? 'application/json' : saved.bodyRawContentType,
        formData: saved.formData,
        urlEncoded: saved.urlEncoded,
        authType: saved.authType,
        auth: saved.auth,
        preRequestScript: saved.preRequestScript,
        testScript: saved.testScript,
        environmentId: activeEnv?.id,
        collectionId: saved.collectionId,
        collectionVariables: collection?.variables
      })

      set({
        response: result.response,
        testResults: result.testResults,
        activeRequest: {
          ...saved,
          lastResponse: result.response,
          lastTestResults: result.testResults
        }
      })
      await get().loadHistory()
    } catch (e) {
      set({
        response: {
          statusCode: 0,
          statusText: 'Error',
          headers: {},
          body: e instanceof Error ? e.message : String(e),
          durationMs: 0,
          sizeBytes: 0,
          cookies: []
        }
      })
    } finally {
      set({ loading: false })
    }
  },

  persistActiveRequest: async () => {
    const req = get().activeRequest
    if (!req) return null
    const saved = await window.fluxAPI.requests.save(req)
    set({ activeRequest: saved })
    await get().loadRequests()
    return saved
  },

  createCollection: async (name, parentId = null) => {
    await window.fluxAPI.collections.create({ name, parentId })
    await get().loadCollections()
  },

  deleteCollection: async (id) => {
    await window.fluxAPI.collections.delete(id)
    await get().loadCollections()
    await get().loadRequests()
  },

  renameCollection: async (id, name) => {
    await window.fluxAPI.collections.update(id, { name })
    await get().loadCollections()
  },

  setCollectionPinned: async (id, pinned) => {
    await window.fluxAPI.collections.update(id, { pinned })
    await get().loadCollections()
  },

  createRequest: async (collectionId = null) => {
    set({
      activeRequest: { ...emptyRequest(), collectionId, name: 'New Request' },
      response: null,
      testResults: []
    })

    const saved = await window.fluxAPI.requests.save({
      name: 'New Request',
      collectionId,
      method: 'GET',
      url: '',
      protocol: 'http'
    })
    set({ activeRequest: saved, response: null, testResults: [] })
    await get().loadRequests()
  },

  deleteRequest: async (id) => {
    await window.fluxAPI.requests.delete(id)
    if (get().activeRequest?.id === id) {
      set({ activeRequest: emptyRequest(), response: null, testResults: [] })
    }
    await get().loadRequests()
  },

  setRequestPinned: async (id, pinned) => {
    const req = get().requests.find((r) => r.id === id)
    if (!req) return
    await window.fluxAPI.requests.save({ ...req, pinned })
    await get().loadRequests()
  },

  setResponse: (response, testResults = []) => set({ response, testResults }),
  setSnippetOpen: (open) => set({ snippetOpen: open }),
  setImportDialog: (open, type = null) => set({ importDialogOpen: open, importType: type }),
  setCurlPaste: (text) => set({ curlPaste: text }),
  setSearchQuery: (q) => set({ searchQuery: q })
}))
