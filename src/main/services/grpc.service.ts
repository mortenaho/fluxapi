import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'
import { readFileSync, existsSync } from 'fs'
import { dirname, basename, join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { getOne, runQuery, getAll } from '../db'
import type { GrpcCallType, GrpcServiceInfo, KeyValue } from '../../../shared/types'

const loadedPackages = new Map<string, grpc.GrpcObject>()

export function importProtoFile(filePath: string) {
  const existing = getOne<{ id: string }>('SELECT id FROM proto_files WHERE file_path = ?', [filePath])
  if (existing) {
    const services = loadProtoFromPath(filePath, existing.id)
    return { protoId: existing.id, services }
  }

  const content = readFileSync(filePath, 'utf-8')
  const id = uuidv4()

  runQuery('INSERT INTO proto_files (id, name, file_path, content, imported_at) VALUES (?,?,?,?,?)', [
    id, basename(filePath), filePath, content, Date.now()
  ])

  const services = loadProtoFromPath(filePath, id)
  return { protoId: id, services }
}

function loadProtoFromPath(filePath: string, protoId: string): GrpcServiceInfo[] {
  const packageDefinition = protoLoader.loadSync(filePath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [dirname(filePath)]
  })

  const pkg = grpc.loadPackageDefinition(packageDefinition)
  loadedPackages.set(protoId, pkg)
  return extractServices(pkg)
}

export function getProtoServices(protoId: string): GrpcServiceInfo[] {
  const row = getOne<{ file_path: string }>('SELECT file_path FROM proto_files WHERE id = ?', [protoId])
  if (!row) throw new Error('Proto file not found')

  if (!loadedPackages.has(protoId)) {
    loadProtoFromPath(row.file_path, protoId)
  }

  return extractServices(loadedPackages.get(protoId)!)
}

function isServiceClient(value: unknown): value is grpc.ServiceClientConstructor {
  return (
    typeof value === 'function' &&
    'service' in value &&
    typeof (value as grpc.ServiceClientConstructor).service === 'object'
  )
}

function extractServices(pkg: grpc.GrpcObject): GrpcServiceInfo[] {
  const services: GrpcServiceInfo[] = []

  function walk(obj: grpc.GrpcObject, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
      if (isServiceClient(value)) {
        const ctor = value
        const methods: GrpcServiceInfo['methods'] = []
        for (const [methodName, methodDef] of Object.entries(ctor.service)) {
          const def = methodDef as { requestStream?: boolean; responseStream?: boolean }
          let callType: GrpcCallType = 'unary'
          if (def.requestStream && def.responseStream) callType = 'bidi_streaming'
          else if (def.requestStream) callType = 'client_streaming'
          else if (def.responseStream) callType = 'server_streaming'
          methods.push({ name: methodName, callType })
        }
        services.push({ name: prefix ? `${prefix}.${key}` : key, methods })
        continue
      }

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        walk(value as grpc.GrpcObject, prefix ? `${prefix}.${key}` : key)
      }
    }
  }

  walk(pkg)
  return services
}

export function invokeGrpc(payload: {
  target: string
  protoId: string
  service: string
  method: string
  callType: GrpcCallType
  metadata: KeyValue[]
  message: string
  messages?: string[]
  sslVerify?: boolean
}): Promise<{ messages: unknown[]; metadata: Record<string, string>; status: string }> {
  const row = getOne<{ file_path: string }>('SELECT file_path FROM proto_files WHERE id = ?', [payload.protoId])
  if (!row) throw new Error('Proto file not found')

  if (!loadedPackages.has(payload.protoId)) {
    loadProtoFromPath(row.file_path, payload.protoId)
  }

  const pkg = loadedPackages.get(payload.protoId)!
  const Client = resolveClient(pkg, payload.service)
  if (!Client) throw new Error(`Service ${payload.service} not found`)

  const creds = payload.sslVerify === false
    ? grpc.credentials.createInsecure()
    : grpc.credentials.createSsl()

  const client = new Client(payload.target, creds)
  const meta = new grpc.Metadata()
  for (const m of payload.metadata) {
    if (m.enabled && m.key) meta.add(m.key, m.value)
  }

  let requestMsg: unknown = {}
  try {
    requestMsg = JSON.parse(payload.message || '{}')
  } catch {
    requestMsg = {}
  }

  return new Promise((resolve, reject) => {
    const messages: unknown[] = []
    const responseMeta: Record<string, string> = {}
    const methodFn = (client as unknown as Record<string, Function>)[payload.method]
    if (!methodFn) {
      reject(new Error(`Method ${payload.method} not found`))
      return
    }

    if (payload.callType === 'server_streaming') {
      const stream = methodFn.call(client, requestMsg, meta)
      stream.on('data', (data: unknown) => messages.push(data))
      stream.on('end', () => {
        client.close()
        resolve({ messages, metadata: responseMeta, status: 'OK' })
      })
      stream.on('error', (err: Error) => {
        client.close()
        reject(err)
      })
    } else {
      methodFn.call(client, requestMsg, meta, (err: grpc.ServiceError | null, response: unknown) => {
        client.close()
        if (err) reject(err)
        else resolve({ messages: [response], metadata: responseMeta, status: 'OK' })
      })
    }
  })
}

function resolveClient(pkg: grpc.GrpcObject, servicePath: string): grpc.ServiceClientConstructor | null {
  const parts = servicePath.split('.')
  let current: unknown = pkg
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part]
    } else {
      return null
    }
  }
  return current as grpc.ServiceClientConstructor
}

export function listProtoFiles() {
  return getAll<{
    id: string
    name: string
    file_path: string
    content: string
    imported_at: number
  }>('SELECT * FROM proto_files')
}

export function deleteProtoFile(id: string) {
  runQuery('DELETE FROM proto_files WHERE id = ?', [id])
  loadedPackages.delete(id)
}

function resolveReflectionProtoPath(): string {
  const candidates = [
    join(process.cwd(), 'resources/grpc/reflection_v1alpha.proto'),
    join(process.resourcesPath, 'grpc/reflection_v1alpha.proto'),
    join(__dirname, '../../resources/grpc/reflection_v1alpha.proto')
  ]
  for (const path of candidates) {
    if (existsSync(path)) return path
  }
  return candidates[0]
}

export function reflectGrpc(target: string): Promise<GrpcServiceInfo[]> {
  const protoPath = resolveReflectionProtoPath()
  const packageDefinition = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  })
  const pkg = grpc.loadPackageDefinition(packageDefinition) as unknown as {
    grpc: { reflection: { v1alpha: { ServerReflection: new (...args: unknown[]) => grpc.Client } } }
  }
  const Client = pkg.grpc.reflection.v1alpha.ServerReflection

  return new Promise((resolve, reject) => {
    const client = new Client(target, grpc.credentials.createInsecure()) as grpc.Client & {
      serverReflectionInfo: () => grpc.ClientDuplexStream<Record<string, unknown>, Record<string, unknown>>
    }
    const call = client.serverReflectionInfo()
    const services: GrpcServiceInfo[] = []

    call.on('data', (response: { list_services_response?: { service?: { name: string }[] } }) => {
      const list = response.list_services_response?.service || []
      for (const item of list) {
        services.push({ name: item.name, methods: [] })
      }
    })
    call.on('error', (err) => reject(err))
    call.on('end', () => resolve(services))
    call.write({ list_services: '' })
    call.end()
  })
}
