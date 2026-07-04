import { test, _electron as electron } from '@playwright/test'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '../..')
const shotsDir = path.join(root, 'docs/screenshots')
const tour = JSON.parse(fs.readFileSync(path.join(root, 'scripts/screenshot-tour.json'), 'utf-8'))

/** @type {import('@playwright/test').ElectronApplication} */
let app
/** @type {import('@playwright/test').Page} */
let page
let userDataDir

async function capture(frameFile) {
  await page.screenshot({
    path: path.join(shotsDir, `${frameFile}.png`),
    animations: 'disabled'
  })
}

async function selectRequestByName(name) {
  await page.evaluate(async (requestName) => {
    const store = window.__lisekStore
    if (!store) throw new Error('Missing window.__lisekStore')
    const req = (await window.lisek.requests.list()).find((r) => r.name === requestName)
    if (!req) throw new Error(`Request not found: ${requestName}`)
    store.getState().setActiveSidebar('collections')
    await store.getState().selectRequest(req)
  }, name)
  await page.waitForTimeout(900)
}

async function openHistoryEntry(urlPattern) {
  await page.evaluate(() => {
    window.__lisekStore?.getState().setActiveSidebar('history')
  })
  await page.getByText(urlPattern).first().click()
  await page.waitForTimeout(900)
}

async function clickTab(name, { prefix = false } = {}) {
  const tab = prefix
    ? page.getByRole('tab', { name: new RegExp(`^${name}\\b`) })
    : page.getByRole('tab', { name, exact: true })
  await tab.click()
  await page.waitForTimeout(500)
}

test.describe.configure({ mode: 'serial' })

test.describe('Product tour screenshots', () => {
  test.beforeAll(async () => {
    const mainEntry = path.join(root, 'out/main/index.js')
    if (!fs.existsSync(mainEntry)) {
      throw new Error('Build the app first: npm run build')
    }

    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lisek-screenshots-'))
    fs.mkdirSync(shotsDir, { recursive: true })

    app = await electron.launch({
      args: [mainEntry, `--user-data-dir=${userDataDir}`],
      env: {
        ...process.env,
        LISEK_USER_DATA: userDataDir,
        LISEK_SCREENSHOT_SEED: '1',
        LISEK_NO_DEVTOOLS: '1'
      }
    })

    page = await app.firstWindow()
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.waitForLoadState('domcontentloaded')
    await page.waitForFunction(() => Boolean(window.__lisekStore), null, { timeout: 30_000 })
    await page.getByRole('button', { name: /GET List Users\b/ }).waitFor({ timeout: 30_000 })
    await page.waitForTimeout(800)
  })

  test.afterAll(async () => {
    await app?.close()
    fs.rmSync(userDataDir, { recursive: true, force: true })
  })

  test('01 — collections: nested folders and pinning', async () => {
    await selectRequestByName('List Users')
    await page.getByText('Users', { exact: true }).click()
    await page.getByRole('button', { name: /GET List Users\b/ }).waitFor({ timeout: 10_000 })
    await capture('01-collections')
  })

  test('02 — http-rest: GET + JSON response', async () => {
    await openHistoryEntry(/GET.*\/users/i)
    await page.getByText('142ms ·').waitFor({ timeout: 10_000 })
    await capture('02-http-rest')
  })

  test('03 — graphql: query editor', async () => {
    await selectRequestByName('GraphQL Products')
    await clickTab('GraphQL')
    await page.getByRole('combobox').filter({ hasText: /graphql/i }).waitFor({ timeout: 10_000 })
    await capture('03-graphql')
  })

  test('04 — websocket: connect and message log', async () => {
    await selectRequestByName('Live Chat WS')
    await clickTab('WebSocket')
    await page.getByRole('button', { name: 'Connect', exact: true }).waitFor({ timeout: 10_000 })
    await capture('04-websocket')
  })

  test('05 — grpc: proto services and unary call', async () => {
    await selectRequestByName('gRPC GetUser')
    await clickTab('gRPC')
    await page.getByText('GetUser (unary)').waitFor({ timeout: 10_000 })
    await capture('05-grpc')
  })

  test('06 — environments: variable editor', async () => {
    await page.getByRole('button', { name: /Production/i }).click()
    await page.getByRole('dialog').getByText('All environments').waitFor({ timeout: 10_000 })
    await capture('06-environments')
    await page.keyboard.press('Escape')
  })

  test('07 — scripts: pm.test assertions', async () => {
    await selectRequestByName('List Users')
    await clickTab('Scripts', { prefix: true })
    await page.getByText('pm.test("Status is 200"').waitFor({ timeout: 10_000 })
    await page.waitForTimeout(600)
    await capture('07-scripts')
  })

  test('08 — history: status codes and timing', async () => {
    await page.evaluate(() => {
      window.__lisekStore?.getState().setActiveSidebar('history')
    })
    await page.getByText(/GET.*\/users/i).first().waitFor({ timeout: 10_000 })
    await capture('08-history')
  })

  test('manifest — every tour frame exists', async () => {
    for (const frame of tour.frames) {
      const file = path.join(shotsDir, `${frame.file}.png`)
      if (!fs.existsSync(file)) {
        throw new Error(`Missing screenshot frame: ${frame.file}.png`)
      }
    }
  })
})
