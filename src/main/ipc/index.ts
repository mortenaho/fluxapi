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
  invokeGrpc,
  listProtoFiles,
  deleteProtoFile,
  reflectGrpc,
  getProtoServices
} from '../services/grpc.service'
import { importPostman, exportPostman } from '../services/import.service'
import { importOpenApi, listOpenApiSpecs, deleteOpenApiSpec, exportToOpenApi, getOpenApiPaths, generateRequestFromSpec } from '../services/openapi.service'
import { parseCurl, exportToCurl } from '../services/curl.service'
import {
  clearCookieJar,
  clearCookiesByDomain,
  listStoredCookies
} from '../services/cookie-jar.service'
import { runCollection } from '../services/runner.service'
import {
  listCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  listRequests,
  getRequest,
  saveRequest,
  deleteRequest,
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
import type { HttpRequestPayload } from '../../../shared/types'
import { APP_INFO } from '../../../shared/appInfo'

export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null) {
  const scriptHost = {
    alert: (message: string) => {
      const win = getMainWindow()
      if (win) {
        dialog.showMessageBoxSync(win, {
          type: 'info',
          title: 'FluxAPI Script',
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
        title: 'FluxAPI Script',
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
    let collectionVars = payload.collectionVariables || []
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
      followRedirects: settings.followRedirects
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

  ipcMain.handle('collections:list', () => listCollections())
  ipcMain.handle('collections:create', (_, data) => createCollection(data))
  ipcMain.handle('collections:update', (_, id, data) => updateCollection(id, data))
  ipcMain.handle('collections:delete', (_, id) => deleteCollection(id))

  ipcMain.handle('requests:list', (_, collectionId?) => listRequests(collectionId))
  ipcMain.handle('requests:get', (_, id) => getRequest(id))
  ipcMain.handle('requests:save', (_, data) => saveRequest(data))
  ipcMain.handle('requests:delete', (_, id) => deleteRequest(id))

  ipcMain.handle('environments:list', () => listEnvironments())
  ipcMain.handle('environments:save', (_, data) => saveEnvironment(data))
  ipcMain.handle('environments:delete', (_, id) => deleteEnvironment(id))
  ipcMain.handle('environments:setActive', (_, id) => setActiveEnvironment(id))

  ipcMain.handle('history:list', (_, limit?) => listHistory(limit))
  ipcMain.handle('history:clear', () => clearHistory())

  ipcMain.handle('import:postman', (_, filePath) => importPostman(filePath))
  ipcMain.handle('import:openapi', (_, filePath) => importOpenApi(filePath))
  ipcMain.handle('import:curl', (_, curlString, collectionId?) => {
    const parsed = parseCurl(curlString)
    return saveRequest({ ...createEmptyRequest(collectionId ?? null), ...parsed })
  })

  ipcMain.handle('export:postman', (_, collectionId, filePath) => exportPostman(collectionId, filePath))
  ipcMain.handle('export:openapi', (_, collectionId, filePath) => exportToOpenApi(collectionId, filePath))
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

  ipcMain.handle('cookies:list', () => listStoredCookies())
  ipcMain.handle('cookies:clearAll', () => clearCookieJar())
  ipcMain.handle('cookies:clearDomain', (_, domain) => clearCookiesByDomain(domain))

  ipcMain.handle('runner:runCollection', async (_, collectionId, stopOnFailure = false) => {
    const settings = getSettings()
    const collection = listCollections().find((c) => c.id === collectionId)
    return runCollection(collectionId, collection?.variables || [], {
      sslVerify: settings.sslVerify,
      timeoutMs: settings.timeoutMs,
      followRedirects: settings.followRedirects,
      stopOnFailure
    })
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

  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:set', (_, partial) => setSettings(partial))

  ipcMain.handle('dialog:openFile', async (_, filters?) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: filters || [{ name: 'All Files', extensions: ['*'] }]
    })
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

  ipcMain.handle('clipboard:writeText', (_, text) => clipboard.writeText(text))

  ipcMain.handle('app:getInfo', () => ({
    ...APP_INFO,
    version: app.getVersion()
  }))

  ipcMain.handle('shell:openExternal', (_, url: string) => {
    void shell.openExternal(url)
  })
}
