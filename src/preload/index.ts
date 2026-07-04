import { contextBridge, ipcRenderer } from 'electron'
import type { FluxAPI } from '../../shared/types'

const fluxAPI: FluxAPI = {
  request: {
    send: (payload) => ipcRenderer.invoke('request:send', payload),
    cancel: (id) => ipcRenderer.invoke('request:cancel', id)
  },
  collections: {
    list: () => ipcRenderer.invoke('collections:list'),
    create: (data) => ipcRenderer.invoke('collections:create', data),
    update: (id, data) => ipcRenderer.invoke('collections:update', id, data),
    delete: (id) => ipcRenderer.invoke('collections:delete', id)
  },
  requests: {
    list: (collectionId?) => ipcRenderer.invoke('requests:list', collectionId),
    get: (id) => ipcRenderer.invoke('requests:get', id),
    save: (data) => ipcRenderer.invoke('requests:save', data),
    delete: (id) => ipcRenderer.invoke('requests:delete', id)
  },
  environments: {
    list: () => ipcRenderer.invoke('environments:list'),
    save: (data) => ipcRenderer.invoke('environments:save', data),
    delete: (id) => ipcRenderer.invoke('environments:delete', id),
    setActive: (id) => ipcRenderer.invoke('environments:setActive', id)
  },
  history: {
    list: (limit?) => ipcRenderer.invoke('history:list', limit),
    clear: () => ipcRenderer.invoke('history:clear')
  },
  import: {
    postman: (filePath) => ipcRenderer.invoke('import:postman', filePath),
    postmanFromUrl: (url) => ipcRenderer.invoke('import:postmanUrl', url),
    openapi: (filePath) => ipcRenderer.invoke('import:openapi', filePath),
    openapiFromUrl: (url) => ipcRenderer.invoke('import:openapiUrl', url),
    insomnia: (filePath) => ipcRenderer.invoke('import:insomnia', filePath),
    insomniaFromUrl: (url) => ipcRenderer.invoke('import:insomniaUrl', url),
    curl: (curlString, collectionId?) => ipcRenderer.invoke('import:curl', curlString, collectionId)
  },
  export: {
    postman: (collectionId, filePath) => ipcRenderer.invoke('export:postman', collectionId, filePath),
    openapi: (collectionId, filePath) => ipcRenderer.invoke('export:openapi', collectionId, filePath),
    curl: (requestId) => ipcRenderer.invoke('export:curl', requestId)
  },
  openapi: {
    list: () => ipcRenderer.invoke('openapi:list'),
    get: async (id) => {
      const specs = await ipcRenderer.invoke('openapi:list')
      return specs.find((s: { id: string }) => s.id === id) || null
    },
    delete: (id) => ipcRenderer.invoke('openapi:delete', id),
    getPaths: (specId) => ipcRenderer.invoke('openapi:getPaths', specId),
    generateRequest: (specId, path, method, collectionId?) =>
      ipcRenderer.invoke('openapi:generateRequest', specId, path, method, collectionId)
  },
  cookies: {
    list: () => ipcRenderer.invoke('cookies:list'),
    clearAll: () => ipcRenderer.invoke('cookies:clearAll'),
    clearDomain: (domain) => ipcRenderer.invoke('cookies:clearDomain', domain)
  },
  runner: {
    runCollection: (collectionId, stopOnFailure) =>
      ipcRenderer.invoke('runner:runCollection', collectionId, stopOnFailure)
  },
  ws: {
    connect: (url, headers) => ipcRenderer.invoke('ws:connect', url, headers),
    send: (connectionId, data) => ipcRenderer.invoke('ws:send', connectionId, data),
    disconnect: (connectionId) => ipcRenderer.invoke('ws:disconnect', connectionId),
    onMessage: (callback) => {
      const handler = (_: unknown, connectionId: string, message: unknown) =>
        callback(connectionId, message as import('../../shared/types').WsMessage)
      ipcRenderer.on('ws:message', handler)
      return () => ipcRenderer.removeListener('ws:message', handler)
    }
  },
  graphql: {
    introspect: (url, headers?) => ipcRenderer.invoke('graphql:introspect', { url, headers })
  },
  grpc: {
    loadProto: (filePath) => ipcRenderer.invoke('grpc:loadProto', filePath),
    getServices: (protoId) => ipcRenderer.invoke('grpc:getServices', protoId),
    reflect: (target) => ipcRenderer.invoke('grpc:reflect', target),
    invoke: (payload) => ipcRenderer.invoke('grpc:invoke', payload),
    cancel: async () => {}
  },
  proto: {
    list: () => ipcRenderer.invoke('proto:list'),
    import: (filePath) => ipcRenderer.invoke('grpc:loadProto', filePath),
    delete: (id) => ipcRenderer.invoke('proto:delete', id)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (settings) => ipcRenderer.invoke('settings:set', settings)
  },
  dialog: {
    openFile: (filters?) => ipcRenderer.invoke('dialog:openFile', filters),
    saveFile: (defaultPath?, filters?) => ipcRenderer.invoke('dialog:saveFile', defaultPath, filters)
  },
  fs: {
    writeTextFile: (filePath, content) => ipcRenderer.invoke('fs:writeTextFile', filePath, content)
  },
  clipboard: {
    writeText: (text) => ipcRenderer.invoke('clipboard:writeText', text)
  },
  app: {
    getInfo: () => ipcRenderer.invoke('app:getInfo')
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url)
  }
}

contextBridge.exposeInMainWorld('fluxAPI', fluxAPI)
