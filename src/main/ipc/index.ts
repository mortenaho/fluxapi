import { ipcMain, dialog, clipboard, BrowserWindow, app, shell } from 'electron'
import { writeFileSync } from 'fs'
import { getSettings, setSettings } from '../db'
import { sendHttpRequest, cancelRequest } from '../services/http.service'
import { runScript } from '../services/script.service'
import { executeGraphQL, introspectGraphQL } from '../services/graphql.service'
import {
  connectWebSocket,
  sendWebSocketMessage,
  disconnectWebSocket
} from '../services/websocket.service'
import {
  importProtoFile,
  importProtoFromUrl,
  invokeGrpc,
  listProtoFiles,
  deleteProtoFile,
  reflectGrpc,
  getProtoServices
} from '../services/grpc.service'
import { importPostman, importPostmanFromUrl, importInsomnia, importInsomniaFromUrl, exportPostman, exportInsomnia } from '../services/import.service'
import { importOpenApi, importOpenApiFromUrl, listOpenApiSpecs, deleteOpenApiSpec, exportToOpenApi, getOpenApiPaths, generateRequestFromSpec, createEnvironmentFromSpec } from '../services/openapi.service'
import { parseCurl, exportToCurl } from '../services/curl.service'
import {
  clearCookieJar,
  clearCookiesByDomain,
  listStoredCookies
} from '../services/cookie-jar.service'
import { runCollection, exportRunnerReport } from '../services/runner.service'
import { exportWorkspace, importWorkspace } from '../services/workspace.service'
import { exportHarFromHistory, exportHarFromRequest, importHar } from '../services/har.service'
import { connectSse, disconnectSse } from '../services/sse.service'
import {
  connectGraphQLSubscription,
  disconnectGraphQLSubscription
} from '../services/graphql-subscription.service'
import {
  addMockRoute,
  clearMockRoutes,
  updateMockRoute,
  ensureMockRoute,
  getMockServerState,
  removeMockRoute,
  restartMockServer,
  startMockServer,
  stopMockServer
} from '../services/mock-server.service'
import { importBrunoCollection, exportBrunoCollection } from '../services/bruno.service'
import {
  exportCollectionToFolder,
  importCollectionFromFolder,
  linkCollectionFolder,
  unlinkCollectionFolder,
  pushCollectionToFolder,
  pullCollectionFromFolder,
  startWatchingCollection,
  stopWatchingCollection,
  listWatchedCollections,
  exportRequestOnSave
} from '../services/collection-sync.service'
import {
  deleteScheduledJob,
  listScheduledJobs,
  runScheduledJobNow,
  saveScheduledJob
} from '../services/schedule.service'
import {
  listCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  listRequests,
  getRequest,
  saveRequest,
  deleteRequest,
  moveRequest,
  saveRequestLastResponse,
  listEnvironments,
  saveEnvironment,
  deleteEnvironment,
  setActiveEnvironment,
  getActiveEnvironment,
  listHistory,
  addHistory,
  clearHistory,
  createEmptyRequest
} from '../services/repository'
import type { CollectionRunOptions, CollectionRunReport, HttpRequestPayload } from '../../../shared/types'
import { APP_INFO } from '../../../shared/appInfo'
import { resolveCollectionVariables } from '../../../shared/collectionVariables'

export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null) {
  const scriptHost = {
    alert: (message: string) => {
      const win = getMainWindow()
      if (win) {
        dialog.showMessageBoxSync(win, {
          type: 'info',
          title: 'Lisek Script',
          message,
          buttons: ['OK']
        })
      }
    },
    confirm: (message: string) => {
      const win = getMainWindow()
      if (!win) return true
      const response = dialog.showMessageBoxSync(win, {
        type: 'question',
          title: 'Lisek Script',
        message,
        buttons: ['OK', 'Cancel'],
        cancelId: 1
      })
      return response === 0
    }
  }

  ipcMain.handle('request:send', async (_, payload: HttpRequestPayload) => {
    const settings = getSettings()
    const activeEnv = getActiveEnvironment()
    let envVars = activeEnv?.variables || []
    let collectionVars = resolveCollectionVariables(payload.collectionId, listCollections())
    const scriptLogs: string[] = []

    let processedPayload = { ...payload }

    let testResults: { name: string; passed: boolean; error?: string }[] = []
    let preRequestTestResults: { name: string; passed: boolean; error?: string }[] = []

    if (payload.preRequestScript?.trim()) {
      const scriptResult = runScript(
        payload.preRequestScript,
        { request: payload, environmentVars: envVars, collectionVars },
        'prerequest',
        scriptHost
      )
      scriptLogs.push(...scriptResult.console.map((line) => `[pre-request] ${line}`))
      processedPayload = { ...processedPayload, ...scriptResult.requestChanges }
      envVars = scriptResult.environmentChanges
      collectionVars = scriptResult.collectionChanges
      preRequestTestResults = scriptResult.testResults
      if (payload.collectionId) {
        updateCollection(payload.collectionId, { variables: scriptResult.collectionChanges })
      }
      if (activeEnv) {
        saveEnvironment({ ...activeEnv, variables: scriptResult.environmentChanges })
      }
    }

    const response = await sendHttpRequest(processedPayload, envVars, collectionVars, {
      sslVerify: settings.sslVerify,
      timeoutMs: settings.timeoutMs,
      followRedirects: settings.followRedirects,
      proxyUrl: settings.proxyUrl
    })

    testResults = [...preRequestTestResults]

    if (payload.testScript?.trim()) {
      const scriptResult = runScript(
        payload.testScript,
        { request: processedPayload, response, environmentVars: envVars, collectionVars },
        'test',
        scriptHost
      )
      scriptLogs.push(...scriptResult.console.map((line) => `[test] ${line}`))
      testResults = [...testResults, ...scriptResult.testResults]
      envVars = scriptResult.environmentChanges
      collectionVars = scriptResult.collectionChanges

      if (payload.collectionId) {
        updateCollection(payload.collectionId, { variables: scriptResult.collectionChanges })
      }
      if (activeEnv) {
        saveEnvironment({ ...activeEnv, variables: scriptResult.environmentChanges })
      }
    }

    const reqSnapshot = payload.requestId ? getRequest(payload.requestId) : null

    if (reqSnapshot) {
      addHistory(reqSnapshot, response, payload.requestId)
      saveRequestLastResponse(reqSnapshot.id, response, testResults)
    }

    return { response, testResults, environmentChanges: envVars, scriptLogs }
  })

  ipcMain.handle('request:cancel', (_, id: string) => cancelRequest(id))

  ipcMain.handle('graphql:execute', async (_, { url, query, variables, headers }) =>
    executeGraphQL(url, query, variables, headers)
  )

  ipcMain.handle('graphql:introspect', async (_, { url, headers }) => introspectGraphQL(url, headers))

  ipcMain.handle('graphql:subscribe', async (_, { url, query, variables, headers }) => {
    const id = await connectGraphQLSubscription(url, query, variables, headers || [], (connectionId, message) => {
      getMainWindow()?.webContents.send('graphql:subscription', connectionId, message)
    })
    return id
  })
  ipcMain.handle('graphql:unsubscribe', (_, connectionId) => disconnectGraphQLSubscription(connectionId))

  ipcMain.handle('sse:connect', async (_, url, headers) => {
    const id = await connectSse(url, headers, (connectionId, message) => {
      getMainWindow()?.webContents.send('sse:message', connectionId, message)
    })
    return id
  })
  ipcMain.handle('sse:disconnect', (_, connectionId) => disconnectSse(connectionId))

  ipcMain.handle('mock:getState', () => getMockServerState())
  ipcMain.handle('mock:start', async (_, port?, seedRoute?, forceRestart?) => {
    if (seedRoute) {
      ensureMockRoute(seedRoute)
    }
    const verifyPath = seedRoute?.path
    if (forceRestart) {
      return restartMockServer(port, verifyPath)
    }
    return startMockServer(port)
  })
  ipcMain.handle('mock:stop', () => stopMockServer())
  ipcMain.handle('mock:addRoute', (_, route) => addMockRoute(route))
  ipcMain.handle('mock:updateRoute', (_, id, route) => updateMockRoute(id, route))
  ipcMain.handle('mock:removeRoute', (_, id) => removeMockRoute(id))
  ipcMain.handle('mock:clearRoutes', () => clearMockRoutes())

  ipcMain.handle('collections:list', () => listCollections())
  ipcMain.handle('collections:create', (_, data) => createCollection(data))
  ipcMain.handle('collections:update', (_, id, data) => updateCollection(id, data))
  ipcMain.handle('collections:delete', (_, id) => deleteCollection(id))

  ipcMain.handle('requests:list', (_, collectionId?) => listRequests(collectionId))
  ipcMain.handle('requests:get', (_, id) => getRequest(id))
  ipcMain.handle('requests:save', (_, data) => {
    const saved = saveRequest(data)
    try {
      exportRequestOnSave(saved)
    } catch {
      /* ignore sync write errors */
    }
    return saved
  })
  ipcMain.handle('requests:delete', (_, id) => deleteRequest(id))
  ipcMain.handle('requests:move', (_, requestId, targetCollectionId, beforeRequestId) =>
    moveRequest(requestId, targetCollectionId ?? null, beforeRequestId ?? null)
  )

  ipcMain.handle('environments:list', () => listEnvironments())
  ipcMain.handle('environments:save', (_, data) => saveEnvironment(data))
  ipcMain.handle('environments:delete', (_, id) => deleteEnvironment(id))
  ipcMain.handle('environments:setActive', (_, id) => setActiveEnvironment(id))

  ipcMain.handle('history:list', (_, limit?) => listHistory(limit))
  ipcMain.handle('history:clear', () => clearHistory())

  ipcMain.handle('import:postman', (_, filePath) => importPostman(filePath))
  ipcMain.handle('import:postmanUrl', (_, url) => importPostmanFromUrl(url))
  ipcMain.handle('import:openapi', (_, filePath) => importOpenApi(filePath))
  ipcMain.handle('import:openapiUrl', (_, url) => importOpenApiFromUrl(url))
  ipcMain.handle('import:bruno', (_, folderPath, collectionId) => importBrunoCollection(folderPath, collectionId ?? null))
  ipcMain.handle('import:insomnia', (_, filePath) => importInsomnia(filePath))
  ipcMain.handle('import:insomniaUrl', (_, url) => importInsomniaFromUrl(url))
  ipcMain.handle('import:har', (_, filePath, collectionId?) => importHar(filePath, collectionId ?? null))
  ipcMain.handle('import:curl', (_, curlString, collectionId?) => {
    const parsed = parseCurl(curlString)
    return saveRequest({ ...createEmptyRequest(collectionId ?? null), ...parsed })
  })

  ipcMain.handle('export:postman', (_, collectionId, filePath) => exportPostman(collectionId, filePath))
  ipcMain.handle('export:insomnia', (_, collectionId, filePath) => exportInsomnia(collectionId, filePath))
  ipcMain.handle('export:bruno', (_, collectionId, folderPath) => exportBrunoCollection(collectionId, folderPath))
  ipcMain.handle('export:openapi', (_, collectionId, filePath) => exportToOpenApi(collectionId, filePath))
  ipcMain.handle('export:har', (_, historyId, filePath) => exportHarFromHistory(historyId, filePath))
  ipcMain.handle('export:harFromRequest', (_, requestId, filePath) => exportHarFromRequest(requestId, filePath))
  ipcMain.handle('export:curl', (_, requestId) => {
    const req = getRequest(requestId)
    if (!req) throw new Error('Request not found')
    return exportToCurl(req)
  })

  ipcMain.handle('openapi:list', () => listOpenApiSpecs())
  ipcMain.handle('openapi:delete', (_, id) => deleteOpenApiSpec(id))
  ipcMain.handle('openapi:getPaths', (_, specId) => getOpenApiPaths(specId))
  ipcMain.handle('openapi:generateRequest', (_, specId, path, method, collectionId?) =>
    generateRequestFromSpec(specId, path, method, collectionId ?? null)
  )
  ipcMain.handle('openapi:createEnvironment', (_, specId, activate = false) =>
    createEnvironmentFromSpec(specId, activate)
  )

  ipcMain.handle('cookies:list', () => listStoredCookies())
  ipcMain.handle('cookies:clearAll', () => clearCookieJar())
  ipcMain.handle('cookies:clearDomain', (_, domain) => clearCookiesByDomain(domain))

  ipcMain.handle('workspace:export', (_, filePath) => exportWorkspace(filePath))
  ipcMain.handle('workspace:import', (_, filePath) => importWorkspace(filePath))

  ipcMain.handle('runner:runCollection', async (_, collectionId, options: CollectionRunOptions = {}) => {
    const settings = getSettings()
    return runCollection(collectionId, {
      sslVerify: settings.sslVerify,
      timeoutMs: settings.timeoutMs,
      followRedirects: settings.followRedirects,
      proxyUrl: settings.proxyUrl,
      ...options
    })
  })

  ipcMain.handle('runner:exportReport', (_, report: CollectionRunReport, filePath: string, format: 'json' | 'html') => {
    exportRunnerReport(report, filePath, format)
  })

  ipcMain.handle('ws:connect', async (_, url, headers) => {
    const id = await connectWebSocket(url, headers, (connectionId, message) => {
      getMainWindow()?.webContents.send('ws:message', connectionId, message)
    })
    return id
  })
  ipcMain.handle('ws:send', (_, connectionId, data) => sendWebSocketMessage(connectionId, data))
  ipcMain.handle('ws:disconnect', (_, connectionId) => disconnectWebSocket(connectionId))

  ipcMain.handle('grpc:loadProto', (_, filePath) => importProtoFile(filePath))
  ipcMain.handle('grpc:importProtoUrl', (_, url) => importProtoFromUrl(url))
  ipcMain.handle('grpc:getServices', (_, protoId) => getProtoServices(protoId))
  ipcMain.handle('grpc:reflect', (_, target) => reflectGrpc(target))
  ipcMain.handle('grpc:invoke', (_, payload) => invokeGrpc(payload))

  ipcMain.handle('proto:list', () =>
    listProtoFiles().map((p) => ({
      id: p.id,
      name: p.name,
      filePath: p.file_path,
      content: p.content,
      importedAt: p.imported_at
    }))
  )
  ipcMain.handle('proto:delete', (_, id) => deleteProtoFile(id))

  ipcMain.handle('sync:exportFolder', (_, collectionId, folderPath) => exportCollectionToFolder(collectionId, folderPath))
  ipcMain.handle('sync:importFolder', (_, folderPath, collectionId) =>
    importCollectionFromFolder(folderPath, null, collectionId ?? undefined)
  )
  ipcMain.handle('sync:linkFolder', (_, collectionId, folderPath) => linkCollectionFolder(collectionId, folderPath))
  ipcMain.handle('sync:unlinkFolder', (_, collectionId) => unlinkCollectionFolder(collectionId))
  ipcMain.handle('sync:push', (_, collectionId) => pushCollectionToFolder(collectionId))
  ipcMain.handle('sync:pull', (_, collectionId) => pullCollectionFromFolder(collectionId))
  ipcMain.handle('sync:startWatch', (_, collectionId) => startWatchingCollection(collectionId))
  ipcMain.handle('sync:stopWatch', (_, collectionId) => stopWatchingCollection(collectionId))
  ipcMain.handle('sync:listWatched', () => listWatchedCollections())

  ipcMain.handle('schedule:list', () => listScheduledJobs())
  ipcMain.handle('schedule:save', (_, data) => saveScheduledJob(data))
  ipcMain.handle('schedule:delete', (_, id) => deleteScheduledJob(id))
  ipcMain.handle('schedule:runNow', (_, id) => runScheduledJobNow(id))

  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:set', (_, partial) => setSettings(partial))

  ipcMain.handle('dialog:openFile', async (_, filters?: { name: string; extensions: string[] }[]) => {
    const win = getMainWindow()
    const hasAllFiles = filters?.some((f: { extensions: string[] }) => f.extensions?.includes('*'))
    const dialogFilters = hasAllFiles
      ? undefined
      : filters?.filter(
          (f: { name: string; extensions: string[] }) => f.extensions?.length && !f.extensions.includes('*')
        )

    const result = await dialog.showOpenDialog({
      ...(win ? { parent: win } : {}),
      properties: ['openFile'],
      ...(dialogFilters?.length ? { filters: dialogFilters } : {})
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:openDirectory', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:saveFile', async (_, defaultPath?, filters?) => {
    const result = await dialog.showSaveDialog({
      defaultPath,
      filters: filters || [{ name: 'JSON', extensions: ['json'] }]
    })
    return result.canceled ? null : result.filePath
  })

  ipcMain.handle('fs:writeTextFile', (_, filePath: string, content: string) => {
    writeFileSync(filePath, content, 'utf-8')
  })

  ipcMain.handle('fs:writeBinaryFile', (_, filePath: string, base64: string) => {
    writeFileSync(filePath, Buffer.from(base64, 'base64'))
  })

  ipcMain.handle('clipboard:writeText', (_, text) => clipboard.writeText(text))

  ipcMain.handle('app:getInfo', () => ({
    ...APP_INFO,
    version: app.getVersion()
  }))

  ipcMain.handle('shell:openExternal', (_, url: string) => {
    void shell.openExternal(url)
  })
}
