import { app, shell, BrowserWindow, nativeImage } from 'electron'
import { join } from 'path'
import { copyFileSync, existsSync } from 'fs'
import { initDatabase } from './db'
import { registerIpcHandlers } from './ipc'
import { seedFreshInstall, seedScreenshotDemo } from './services/repository'
import { configureCookieJar } from './services/cookie-jar.service'
import { initScheduledJobs } from './services/schedule.service'
import { shutdownMockServer, reconcileMockServerOnStartup } from './services/mock-server.service'
import { APP_INFO } from '../../shared/appInfo'

let mainWindow: BrowserWindow | null = null

const isDev = !app.isPackaged

if (process.env.LISEK_USER_DATA) {
  app.setPath('userData', process.env.LISEK_USER_DATA)
}

if (process.platform === 'win32') {
  app.setAppUserModelId('com.lisek.app')
}

if (app.isPackaged) {
  app.setPath('userData', join(app.getPath('appData'), 'Lisek'))
}

function resolveDbPath(): string {
  const userData = app.getPath('userData')
  const dbPath = join(userData, 'lisek.db')
  if (existsSync(dbPath)) return dbPath

  const legacyDbPaths = [
    join(app.getPath('appData'), 'FluxAPI', 'fluxapi.db'),
    join(userData, 'fluxapi.db')
  ]
  for (const legacy of legacyDbPaths) {
    if (existsSync(legacy)) {
      copyFileSync(legacy, dbPath)
      return dbPath
    }
  }
  return dbPath
}

function resolveCookieJarPath(): string {
  const userData = app.getPath('userData')
  const cookiePath = join(userData, 'cookies.json')
  if (existsSync(cookiePath)) return cookiePath

  const legacyCookiePaths = [
    join(app.getPath('appData'), 'FluxAPI', 'cookies.json'),
    join(userData, 'cookies.json')
  ]
  for (const legacy of legacyCookiePaths) {
    if (legacy !== cookiePath && existsSync(legacy)) {
      copyFileSync(legacy, cookiePath)
      return cookiePath
    }
  }
  return cookiePath
}

function resolveAppIcon(): Electron.NativeImage | undefined {
  const candidates: string[] = []

  if (isDev) {
    candidates.push(
      join(process.cwd(), 'resources/icon.ico'),
      join(process.cwd(), 'resources/lisek-logo.png')
    )
  }

  candidates.push(
    join(process.resourcesPath, 'icon.ico'),
    join(process.resourcesPath, 'lisek-logo.png'),
    join(__dirname, '../../resources/icon.ico'),
    join(__dirname, '../../resources/lisek-logo.png'),
    join(__dirname, '../renderer/lisek-logo.png')
  )

  for (const path of candidates) {
    if (!existsSync(path)) continue
    const image = nativeImage.createFromPath(path)
    if (!image.isEmpty()) return image
  }

  return undefined
}

function createWindow(): void {
  const icon = resolveAppIcon()

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: `${APP_INFO.name} v${app.getVersion()}`,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (icon) mainWindow?.setIcon(icon)
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    if (process.env.LISEK_NO_DEVTOOLS !== '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  const appIcon = resolveAppIcon()
  if (appIcon) {
    app.dock?.setIcon(appIcon)
  }

  const dbPath = resolveDbPath()
  configureCookieJar(resolveCookieJarPath())
  const { isNew } = await initDatabase(dbPath)
  if (process.env.LISEK_SCREENSHOT_SEED === '1') {
    seedScreenshotDemo()
  } else if (isNew) {
    seedFreshInstall()
  }
  registerIpcHandlers(() => mainWindow)
  await reconcileMockServerOnStartup()
  initScheduledJobs()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  void shutdownMockServer()
})
