import { contextBridge, ipcRenderer } from 'electron'
import type { LisekAPI } from '../../shared/types'

const lisek: LisekAPI = {
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
    delete: (id) => ipcRenderer.invoke('requests:delete', id),
    move: (requestId, targetCollectionId, beforeRequestId) =>
      ipcRenderer.invoke('requests:move', requestId, targetCollectionId, beforeRequestId)
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
    har: (filePath, collectionId) => ipcRenderer.invoke('import:har', filePath, collectionId),
    curl: (curlString, collectionId?) => ipcRenderer.invoke('import:curl', curlString, collectionId),
    bruno: (folderPath, collectionId?) => ipcRenderer.invoke('import:bruno', folderPath, collectionId)
  },
  export: {
    postman: (collectionId, filePath) => ipcRenderer.invoke('export:postman', collectionId, filePath),
    openapi: (collectionId, filePath) => ipcRenderer.invoke('export:openapi', collectionId, filePath),
    insomnia: (collectionId, filePath) => ipcRenderer.invoke('export:insomnia', collectionId, filePath),
    bruno: (collectionId, folderPath) => ipcRenderer.invoke('export:bruno', collectionId, folderPath),
    curl: (requestId) => ipcRenderer.invoke('export:curl', requestId),
    har: (historyId, filePath) => ipcRenderer.invoke('export:har', historyId, filePath),
    harFromRequest: (requestId, filePath) => ipcRenderer.invoke('export:harFromRequest', requestId, filePath)
  },
  workspace: {
    export: (filePath) => ipcRenderer.invoke('workspace:export', filePath),
    import: (filePath) => ipcRenderer.invoke('workspace:import', filePath)
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
      ipcRenderer.invoke('openapi:generateRequest', specId, path, method, collectionId),
    createEnvironment: (specId, activate) => ipcRenderer.invoke('openapi:createEnvironment', specId, activate)
  },
  cookies: {
    list: () => ipcRenderer.invoke('cookies:list'),
    clearAll: () => ipcRenderer.invoke('cookies:clearAll'),
    clearDomain: (domain) => ipcRenderer.invoke('cookies:clearDomain', domain)
  },
  runner: {
    runCollection: (collectionId, options) =>
      ipcRenderer.invoke('runner:runCollection', collectionId, options),
    exportReport: (report, filePath, format) =>
      ipcRenderer.invoke('runner:exportReport', report, filePath, format)
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
    introspect: (url, headers?) => ipcRenderer.invoke('graphql:introspect', { url, headers }),
    subscribe: (url, query, variables, headers) =>
      ipcRenderer.invoke('graphql:subscribe', { url, query, variables, headers }),
    unsubscribe: (connectionId) => ipcRenderer.invoke('graphql:unsubscribe', connectionId),
    onSubscriptionMessage: (callback) => {
      const handler = (_: unknown, connectionId: string, message: unknown) =>
        callback(connectionId, message as import('../../shared/types').WsMessage)
      ipcRenderer.on('graphql:subscription', handler)
      return () => ipcRenderer.removeListener('graphql:subscription', handler)
    }
  },
  sse: {
    connect: (url, headers) => ipcRenderer.invoke('sse:connect', url, headers),
    disconnect: (connectionId) => ipcRenderer.invoke('sse:disconnect', connectionId),
    onMessage: (callback) => {
      const handler = (_: unknown, connectionId: string, message: unknown) =>
        callback(connectionId, message as import('../../shared/types').SseMessage)
      ipcRenderer.on('sse:message', handler)
      return () => ipcRenderer.removeListener('sse:message', handler)
    }
  },
  mock: {
    getState: () => ipcRenderer.invoke('mock:getState'),
    start: (port, seedRoute, forceRestart) => ipcRenderer.invoke('mock:start', port, seedRoute, forceRestart),
    stop: () => ipcRenderer.invoke('mock:stop'),
    addRoute: (route) => ipcRenderer.invoke('mock:addRoute', route),
    updateRoute: (id, route) => ipcRenderer.invoke('mock:updateRoute', id, route),
    removeRoute: (id) => ipcRenderer.invoke('mock:removeRoute', id),
    clearRoutes: () => ipcRenderer.invoke('mock:clearRoutes')
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
    importFromUrl: (url) => ipcRenderer.invoke('grpc:importProtoUrl', url),
    delete: (id) => ipcRenderer.invoke('proto:delete', id)
  },
  sync: {
    exportFolder: (collectionId, folderPath) => ipcRenderer.invoke('sync:exportFolder', collectionId, folderPath),
    importFolder: (folderPath, collectionId) => ipcRenderer.invoke('sync:importFolder', folderPath, collectionId),
    linkFolder: (collectionId, folderPath) => ipcRenderer.invoke('sync:linkFolder', collectionId, folderPath),
    unlinkFolder: (collectionId) => ipcRenderer.invoke('sync:unlinkFolder', collectionId),
    push: (collectionId) => ipcRenderer.invoke('sync:push', collectionId),
    pull: (collectionId) => ipcRenderer.invoke('sync:pull', collectionId),
    startWatch: (collectionId) => ipcRenderer.invoke('sync:startWatch', collectionId),
    stopWatch: (collectionId) => ipcRenderer.invoke('sync:stopWatch', collectionId),
    listWatched: () => ipcRenderer.invoke('sync:listWatched')
  },
  schedule: {
    list: () => ipcRenderer.invoke('schedule:list'),
    save: (data) => ipcRenderer.invoke('schedule:save', data),
    delete: (id) => ipcRenderer.invoke('schedule:delete', id),
    runNow: (id) => ipcRenderer.invoke('schedule:runNow', id)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (settings) => ipcRenderer.invoke('settings:set', settings)
  },
  dialog: {
    openFile: (filters?) => ipcRenderer.invoke('dialog:openFile', filters),
    openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
    saveFile: (defaultPath?, filters?) => ipcRenderer.invoke('dialog:saveFile', defaultPath, filters)
  },
  fs: {
    writeTextFile: (filePath, content) => ipcRenderer.invoke('fs:writeTextFile', filePath, content),
    writeBinaryFile: (filePath, base64) => ipcRenderer.invoke('fs:writeBinaryFile', filePath, base64)
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

contextBridge.exposeInMainWorld('lisek', lisek)
