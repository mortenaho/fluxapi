import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const buildOutput = path.join(os.tmpdir(), 'fluxapi-dist')
const projectOutput = path.join(root, 'dist-installer')
const installerName = `FluxAPI Setup ${version}.exe`
const src = path.join(buildOutput, installerName)
const dest = path.join(projectOutput, installerName)

if (!fs.existsSync(src)) {
  console.error(`[post-dist] Installer not found: ${src}`)
  process.exit(1)
}

fs.mkdirSync(projectOutput, { recursive: true })
fs.copyFileSync(src, dest)

const sizeMb = (fs.statSync(dest).size / (1024 * 1024)).toFixed(1)
console.log(`[post-dist] Copied installer to ${dest} (${sizeMb} MB)`)
