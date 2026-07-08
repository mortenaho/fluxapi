import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
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
import { resolveCollectionVariables } from '@shared/collectionVariables'

export interface RequestTab {
  tabId: string
  request: RequestModel
  response: HttpResponse | null
  testResults: TestResult[]
  scriptLogs: string[]
}

interface AppState {
  themeMode: 'light' | 'dark'
  collections: CollectionModel[]
  requests: RequestModel[]
  environments: EnvironmentModel[]
  history: HistoryModel[]
  openapiSpecs: OpenApiSpecModel[]
  protoFiles: ProtoFileModel[]
  requestTabs: RequestTab[]
  activeTabId: string | null
  activeRequest: RequestModel | null
  activeSidebar: 'collections' | 'history' | 'openapi' | 'proto' | 'plugins'
  response: HttpResponse | null
  testResults: TestResult[]
  scriptLogs: string[]
  loading: boolean
  wsConnectionId: string | null
  wsMessages: import('@shared/types').WsMessage[]
  sseConnectionId: string | null
  sseMessages: import('@shared/types').SseMessage[]
  gqlSubscriptionId: string | null
  settings: Settings
  snippetOpen: boolean
  importDialogOpen: boolean
  importType: 'postman' | 'openapi' | 'insomnia' | 'curl' | null
  curlPaste: string
  searchQuery: string
  commandPaletteOpen: boolean
  shortcutsOpen: boolean
  mockServerRunning: boolean
  mockServerPort: number

  loadInitial: () => Promise<void>
  setThemeMode: (mode: 'light' | 'dark') => void
  setActiveSidebar: (tab: AppState['activeSidebar']) => void
  setActiveRequest: (req: RequestModel | null) => void
  selectRequest: (req: RequestModel | null) => Promise<void>
  openHistoryItem: (item: HistoryModel) => void
  updateActiveRequest: (partial: Partial<RequestModel>) => void
  switchTab: (tabId: string) => Promise<void>
  closeTab: (tabId: string) => void
  closeActiveTab: () => void
  setCommandPaletteOpen: (open: boolean) => void
  setShortcutsOpen: (open: boolean) => void
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
  setResponse: (response: HttpResponse | null, testResults?: TestResult[], scriptLogs?: string[]) => void
  setSnippetOpen: (open: boolean) => void
  setImportDialog: (open: boolean, type?: AppState['importType']) => void
  setCurlPaste: (text: string) => void
  setSearchQuery: (q: string) => void
  refreshMockServerState: () => Promise<void>
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
  sortOrder: 0,
  pinned: false,
  createdAt: Date.now(),
  updatedAt: Date.now()
})

function tabKeyForRequest(req: RequestModel): string {
  return req.id || `draft-${req.createdAt}`
}

function syncFromTab(tab: RequestTab) {
  return {
    activeTabId: tab.tabId,
    activeRequest: tab.request,
    response: tab.response,
    testResults: tab.testResults,
    scriptLogs: tab.scriptLogs
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  themeMode: 'light',
  collections: [],
  requests: [],
  environments: [],
  history: [],
  openapiSpecs: [],
  protoFiles: [],
  requestTabs: [],
  activeTabId: null,
  activeRequest: null,
  activeSidebar: 'collections',
  response: null,
  testResults: [],
  scriptLogs: [],
  loading: false,
  wsConnectionId: null,
  wsMessages: [],
  sseConnectionId: null,
  sseMessages: [],
  gqlSubscriptionId: null,
  settings: { sslVerify: true, timeoutMs: 30000, followRedirects: true, theme: 'light' },
  snippetOpen: false,
  importDialogOpen: false,
  importType: null,
  curlPaste: '',
  searchQuery: '',
  commandPaletteOpen: false,
  shortcutsOpen: false,
  mockServerRunning: false,
  mockServerPort: 0,

  loadInitial: async () => {
    const settings = await window.lisek.settings.get()
    set({ settings, themeMode: settings.theme })
    await Promise.all([
      get().loadCollections(),
      get().loadRequests(),
      get().loadEnvironments(),
      get().loadHistory(),
      get().loadOpenApiSpecs(),
      get().loadProtoFiles(),
      get().refreshMockServerState()
    ])
  },

  setThemeMode: async (mode) => {
    await window.lisek.settings.set({ theme: mode })
    set({ themeMode: mode, settings: { ...get().settings, theme: mode } })
  },

  setActiveSidebar: (tab) => set({ activeSidebar: tab }),

  setActiveRequest: (req) => {
    if (!req) {
      set({ activeRequest: null, response: null, testResults: [], scriptLogs: [] })
      return
    }
    const tabId = get().activeTabId || uuidv4()
    const tabs = get().requestTabs
    const existing = tabs.find((t) => t.tabId === tabId)
    if (existing) {
      set({
        requestTabs: tabs.map((t) =>
          t.tabId === tabId ? { ...t, request: req, response: null, testResults: [], scriptLogs: [] } : t
        ),
        activeRequest: req,
        response: null,
        testResults: [],
        scriptLogs: []
      })
    } else {
      const tab: RequestTab = {
        tabId,
        request: req,
        response: null,
        testResults: [],
        scriptLogs: []
      }
      set({ requestTabs: [...tabs, tab], ...syncFromTab(tab) })
    }
  },

  selectRequest: async (req) => {
    const state = get()
    const { activeTabId, activeRequest, requestTabs, response, testResults, scriptLogs } = state

    let tabs = requestTabs
    if (activeTabId && activeRequest) {
      tabs = tabs.map((t) =>
        t.tabId === activeTabId ? { ...t, request: activeRequest, response, testResults, scriptLogs } : t
      )
    }

    if (!req) {
      set({ requestTabs: tabs, activeTabId: null, activeRequest: null, response: null, testResults: [], scriptLogs: [] })
      return
    }

    const key = tabKeyForRequest(req)
    const existingTab = tabs.find((t) => tabKeyForRequest(t.request) === key || (req.id && t.request.id === req.id))

    if (existingTab) {
      set({ requestTabs: tabs, ...syncFromTab(existingTab) })
      if (req.id) {
        const full = await window.lisek.requests.get(req.id)
        if (full) {
          const updatedTab = {
            ...existingTab,
            request: full,
            response: full.lastResponse ?? existingTab.response,
            testResults: full.lastTestResults ?? existingTab.testResults
          }
          set({
            requestTabs: get().requestTabs.map((t) => (t.tabId === existingTab.tabId ? updatedTab : t)),
            ...syncFromTab(updatedTab)
          })
        }
      }
      return
    }

    const tab: RequestTab = {
      tabId: uuidv4(),
      request: req,
      response: null,
      testResults: [],
      scriptLogs: []
    }
    set({ requestTabs: [...tabs, tab], ...syncFromTab(tab) })

    if (req.id) {
      const full = await window.lisek.requests.get(req.id)
      if (full && get().activeTabId === tab.tabId) {
        const loaded: RequestTab = {
          ...tab,
          request: full,
          response: full.lastResponse ?? null,
          testResults: full.lastTestResults ?? []
        }
        set({
          requestTabs: get().requestTabs.map((t) => (t.tabId === tab.tabId ? loaded : t)),
          ...syncFromTab(loaded)
        })
      }
    }
  },

  switchTab: async (tabId) => {
    const { activeTabId, activeRequest, requestTabs, response, testResults, scriptLogs } = get()
    let tabs = requestTabs
    if (activeTabId && activeRequest) {
      tabs = tabs.map((t) =>
        t.tabId === activeTabId ? { ...t, request: activeRequest, response, testResults, scriptLogs } : t
      )
    }
    const next = tabs.find((t) => t.tabId === tabId)
    if (!next) return
    set({ requestTabs: tabs, ...syncFromTab(next) })
  },

  closeTab: (tabId) => {
    const { activeTabId, activeRequest, requestTabs, response, testResults, scriptLogs } = get()
    let tabs = requestTabs
    if (activeTabId && activeRequest) {
      tabs = tabs.map((t) =>
        t.tabId === activeTabId ? { ...t, request: activeRequest, response, testResults, scriptLogs } : t
      )
    }
    const idx = tabs.findIndex((t) => t.tabId === tabId)
    if (idx < 0) return
    const remaining = tabs.filter((t) => t.tabId !== tabId)
    if (tabId === activeTabId) {
      const next = remaining[Math.min(idx, remaining.length - 1)]
      if (next) {
        set({ requestTabs: remaining, ...syncFromTab(next) })
      } else {
        set({ requestTabs: [], activeTabId: null, activeRequest: null, response: null, testResults: [], scriptLogs: [] })
      }
    } else {
      set({ requestTabs: remaining })
    }
  },

  closeActiveTab: () => {
    const { activeTabId } = get()
    if (activeTabId) get().closeTab(activeTabId)
  },

  openHistoryItem: (item) => {
    const tab: RequestTab = {
      tabId: uuidv4(),
      request: item.requestSnapshot,
      response: item.responseSnapshot,
      testResults: [],
      scriptLogs: []
    }
    const key = tabKeyForRequest(item.requestSnapshot)
    const existing = get().requestTabs.find((t) => tabKeyForRequest(t.request) === key)
    if (existing) {
      const updated = { ...existing, response: item.responseSnapshot, testResults: [], scriptLogs: [] }
      set({
        requestTabs: get().requestTabs.map((t) => (t.tabId === existing.tabId ? updated : t)),
        ...syncFromTab(updated)
      })
      return
    }
    set({ requestTabs: [...get().requestTabs, tab], ...syncFromTab(tab) })
  },

  updateActiveRequest: (partial) => {
    const current = get().activeRequest
    if (!current) return
    set({ activeRequest: { ...current, ...partial } })
  },

  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),

  loadCollections: async () => {
    const collections = await window.lisek.collections.list()
    set({ collections })
  },

  loadRequests: async () => {
    const requests = await window.lisek.requests.list()
    set({ requests })
  },

  loadEnvironments: async () => {
    const environments = await window.lisek.environments.list()
    set({ environments })
  },

  loadHistory: async () => {
    const history = await window.lisek.history.list()
    set({ history })
  },

  loadOpenApiSpecs: async () => {
    const openapiSpecs = await window.lisek.openapi.list()
    set({ openapiSpecs })
  },

  loadProtoFiles: async () => {
    const protoFiles = await window.lisek.proto.list()
    set({ protoFiles })
  },

  sendRequest: async () => {
    const saved = await get().persistActiveRequest()
    if (!saved) return

    set({ loading: true, response: null, testResults: [], scriptLogs: [] })

    try {
      if (saved.protocol === 'websocket') {
        const id = await window.lisek.ws.connect(saved.wsUrl || saved.url, saved.headers)
        set({ wsConnectionId: id })
        return
      }

      if (saved.protocol === 'sse') {
        const id = await window.lisek.sse.connect(saved.sseUrl || saved.url, saved.headers)
        set({ sseConnectionId: id, sseMessages: [] })
        return
      }

      if (saved.protocol === 'graphql' && saved.graphqlOperationType === 'subscription') {
        const id = await window.lisek.graphql.subscribe(
          saved.url,
          saved.graphqlQuery,
          saved.graphqlVariables,
          saved.headers
        )
        set({ gqlSubscriptionId: id, wsMessages: [] })
        return
      }

      if (saved.protocol === 'grpc') {
        const result = await window.lisek.grpc.invoke({
          target: saved.grpcTarget,
          protoId: saved.grpcProtoId!,
          service: saved.grpcService,
          method: saved.grpcMethod,
          callType: saved.grpcCallType,
          metadata: saved.grpcMetadata,
          message: saved.grpcMessage,
          sslVerify: get().settings.sslVerify
        })
        const grpcResponse = {
          statusCode: 200,
          statusText: result.status,
          headers: result.metadata,
          body: JSON.stringify(result.messages, null, 2),
          durationMs: 0,
          sizeBytes: 0,
          cookies: []
        }
        set({
          response: grpcResponse,
          activeRequest: { ...saved, lastResponse: grpcResponse }
        })
        return
      }

      const activeEnv = get().environments.find((e) => e.isActive)
      const collectionVariables = resolveCollectionVariables(saved.collectionId, get().collections)

      const result = await window.lisek.request.send({
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
        collectionVariables
      })

      const updatedRequest = {
        ...saved,
        lastResponse: result.response,
        lastTestResults: result.testResults
      }
      set({
        response: result.response,
        testResults: result.testResults,
        scriptLogs: result.scriptLogs ?? [],
        activeRequest: updatedRequest
      })

      const { activeTabId, requestTabs } = get()
      if (activeTabId) {
        set({
          requestTabs: requestTabs.map((t) =>
            t.tabId === activeTabId
              ? {
                  ...t,
                  request: updatedRequest,
                  response: result.response,
                  testResults: result.testResults,
                  scriptLogs: result.scriptLogs ?? []
                }
              : t
          )
        })
      }
      await get().loadHistory()
    } catch (e) {
      const errResponse = {
        statusCode: 0,
        statusText: 'Error',
        headers: {},
        body: e instanceof Error ? e.message : String(e),
        durationMs: 0,
        sizeBytes: 0,
        cookies: []
      }
      set({ response: errResponse })
    } finally {
      set({ loading: false })
    }
  },

  persistActiveRequest: async () => {
    const req = get().activeRequest
    if (!req) return null
    const saved = await window.lisek.requests.save(req)
    set({ activeRequest: saved })
    const { activeTabId, requestTabs } = get()
    if (activeTabId) {
      set({
        requestTabs: requestTabs.map((t) => (t.tabId === activeTabId ? { ...t, request: saved } : t))
      })
    }
    await get().loadRequests()
    return saved
  },

  createCollection: async (name, parentId = null) => {
    await window.lisek.collections.create({ name, parentId })
    await get().loadCollections()
  },

  deleteCollection: async (id) => {
    await window.lisek.collections.delete(id)
    await get().loadCollections()
    await get().loadRequests()
  },

  renameCollection: async (id, name) => {
    await window.lisek.collections.update(id, { name })
    await get().loadCollections()
  },

  setCollectionPinned: async (id, pinned) => {
    await window.lisek.collections.update(id, { pinned })
    await get().loadCollections()
  },

  createRequest: async (collectionId = null) => {
    const saved = await window.lisek.requests.save({
      name: 'New Request',
      collectionId,
      method: 'GET',
      url: '',
      protocol: 'http'
    })
    const tab: RequestTab = {
      tabId: uuidv4(),
      request: saved,
      response: null,
      testResults: [],
      scriptLogs: []
    }
    set({
      requestTabs: [...get().requestTabs, tab],
      ...syncFromTab(tab)
    })
    await get().loadRequests()
  },

  deleteRequest: async (id) => {
    await window.lisek.requests.delete(id)
    const closing = get().requestTabs.filter((t) => t.request.id === id).map((t) => t.tabId)
    for (const tabId of closing) {
      get().closeTab(tabId)
    }
    if (get().requestTabs.length === 0) {
      set({ activeRequest: null, activeTabId: null, response: null, testResults: [], scriptLogs: [] })
    }
    await get().loadRequests()
  },

  setRequestPinned: async (id, pinned) => {
    const req = get().requests.find((r) => r.id === id)
    if (!req) return
    await window.lisek.requests.save({ ...req, pinned })
    await get().loadRequests()
  },

  setResponse: (response, testResults = [], scriptLogs = []) =>
    set({ response, testResults, scriptLogs }),
  setSnippetOpen: (open) => set({ snippetOpen: open }),
  setImportDialog: (open, type = null) => set({ importDialogOpen: open, importType: type }),
  setCurlPaste: (text) => set({ curlPaste: text }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  refreshMockServerState: async () => {
    try {
      const state = await window.lisek.mock.getState()
      set({ mockServerRunning: state.running, mockServerPort: state.port })
    } catch {
      set({ mockServerRunning: false, mockServerPort: 0 })
    }
  }
}))
