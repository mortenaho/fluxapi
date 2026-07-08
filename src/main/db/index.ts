import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { createRequire } from 'node:module'
import initSqlJs, { Database } from 'sql.js'
import type { Settings } from '../../../shared/types'

const require = createRequire(import.meta.url)
const sqlJsDir = dirname(require.resolve('sql.js/dist/sql-wasm.js'))

let db: Database | null = null
let dbPath = ''

const DEFAULT_SETTINGS: Record<string, string> = {
  sslVerify: 'true',
  timeoutMs: '30000',
  followRedirects: 'true',
  theme: 'light',
  proxyUrl: '',
  runnerIterations: '1',
  runnerDelayMs: '0',
  autoUpdate: 'true'
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  pinned INTEGER NOT NULL DEFAULT 0,
  variables_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  collection_id TEXT,
  name TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  url TEXT NOT NULL DEFAULT '',
  headers_json TEXT NOT NULL DEFAULT '[]',
  params_json TEXT NOT NULL DEFAULT '[]',
  body_type TEXT NOT NULL DEFAULT 'none',
  body_json TEXT NOT NULL DEFAULT '{}',
  auth_type TEXT NOT NULL DEFAULT 'none',
  auth_json TEXT NOT NULL DEFAULT '{}',
  pre_request_script TEXT NOT NULL DEFAULT '',
  test_script TEXT NOT NULL DEFAULT '',
  protocol TEXT NOT NULL DEFAULT 'http',
  graphql_query TEXT NOT NULL DEFAULT '',
  graphql_variables TEXT NOT NULL DEFAULT '{}',
  ws_url TEXT NOT NULL DEFAULT '',
  ws_messages_json TEXT NOT NULL DEFAULT '[]',
  grpc_target TEXT NOT NULL DEFAULT '',
  grpc_service TEXT NOT NULL DEFAULT '',
  grpc_method TEXT NOT NULL DEFAULT '',
  grpc_call_type TEXT NOT NULL DEFAULT 'unary',
  grpc_proto_id TEXT,
  grpc_metadata_json TEXT NOT NULL DEFAULT '[]',
  grpc_message_json TEXT NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS proto_files (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  content TEXT NOT NULL,
  imported_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS openapi_specs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  format TEXT NOT NULL,
  content TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL DEFAULT '',
  servers_json TEXT NOT NULL DEFAULT '[]',
  imported_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS environments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  variables_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS history (
  id TEXT PRIMARY KEY,
  request_id TEXT,
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  request_snapshot_json TEXT NOT NULL,
  response_snapshot_json TEXT NOT NULL,
  sent_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`

function migrateSchema(database: Database) {
  const tableColumns = (table: string) => {
    const result = database.exec(`PRAGMA table_info(${table})`)
    const names = new Set<string>()
    if (result[0]) {
      for (const row of result[0].values) {
        names.add(String(row[1]))
      }
    }
    return names
  }

  const requestColumns = tableColumns('requests')
  if (!requestColumns.has('last_response_json')) {
    database.run('ALTER TABLE requests ADD COLUMN last_response_json TEXT')
  }
  if (!requestColumns.has('last_test_results_json')) {
    database.run('ALTER TABLE requests ADD COLUMN last_test_results_json TEXT')
  }
  if (!requestColumns.has('pinned')) {
    database.run('ALTER TABLE requests ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0')
  }

  const collectionColumns = tableColumns('collections')
  if (!collectionColumns.has('pinned')) {
    database.run('ALTER TABLE collections ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0')
  }
  if (!collectionColumns.has('description')) {
    database.run("ALTER TABLE collections ADD COLUMN description TEXT NOT NULL DEFAULT ''")
  }

  if (!requestColumns.has('tags_json')) {
    database.run("ALTER TABLE requests ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]'")
  }
  if (!requestColumns.has('notes')) {
    database.run("ALTER TABLE requests ADD COLUMN notes TEXT NOT NULL DEFAULT ''")
  }
  if (!requestColumns.has('sse_url')) {
    database.run("ALTER TABLE requests ADD COLUMN sse_url TEXT NOT NULL DEFAULT ''")
  }
  if (!requestColumns.has('sse_messages_json')) {
    database.run("ALTER TABLE requests ADD COLUMN sse_messages_json TEXT NOT NULL DEFAULT '[]'")
  }
  if (!requestColumns.has('graphql_operation_type')) {
    database.run("ALTER TABLE requests ADD COLUMN graphql_operation_type TEXT NOT NULL DEFAULT 'query'")
  }
}

export async function initDatabase(path: string): Promise<{ isNew: boolean }> {
  dbPath = path
  mkdirSync(dirname(path), { recursive: true })

  const isNew = !existsSync(path)
  const SQL = await initSqlJs({
    locateFile: (file: string) => join(sqlJsDir, file)
  })

  if (isNew) {
    db = new SQL.Database()
  } else {
    const buffer = readFileSync(path)
    db = new SQL.Database(buffer)
  }

  db.run(SCHEMA)
  migrateSchema(db)

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const existing = getOne<{ key: string }>('SELECT key FROM settings WHERE key = ?', [key])
    if (!existing) {
      db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value])
    }
  }
  persist()
  return { isNew }
}

export function persist() {
  if (!db || !dbPath) return
  const data = db.export()
  writeFileSync(dbPath, Buffer.from(data))
}

export function getDb(): Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

export function getSettings(): Settings {
  const database = getDb()
  const result = database.exec('SELECT key, value FROM settings')
  const map: Record<string, string> = {}
  if (result[0]) {
    for (const row of result[0].values) {
      map[String(row[0])] = String(row[1])
    }
  }
  return {
    sslVerify: map.sslVerify !== 'false',
    timeoutMs: parseInt(map.timeoutMs || '30000', 10),
    followRedirects: map.followRedirects !== 'false',
    theme: (map.theme as 'light' | 'dark') || 'light',
    proxyUrl: map.proxyUrl || '',
    runnerIterations: Math.max(1, parseInt(map.runnerIterations || '1', 10)),
    runnerDelayMs: Math.max(0, parseInt(map.runnerDelayMs || '0', 10)),
    autoUpdate: map.autoUpdate !== 'false'
  }
}

export function setSettings(partial: Partial<Settings>): Settings {
  const database = getDb()
  for (const [key, value] of Object.entries(partial)) {
    database.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)])
  }
  persist()
  return getSettings()
}

export function runQuery(sql: string, params: unknown[] = []) {
  getDb().run(sql, params as (string | number | null)[])
  persist()
}

export function getAll<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  const stmt = getDb().prepare(sql)
  stmt.bind(params as (string | number | null)[])
  const rows: T[] = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T)
  }
  stmt.free()
  return rows
}

export function getOne<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
  return getAll<T>(sql, params)[0]
}

export function getDatabasePath(): string {
  return dbPath
}
