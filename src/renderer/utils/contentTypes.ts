export interface ContentTypeOption {
  label: string
  value: string
}

export interface ContentTypeGroup {
  label: string
  types: ContentTypeOption[]
}

export const CONTENT_TYPE_GROUPS: ContentTypeGroup[] = [
  {
    label: 'JSON & API',
    types: [
      { label: 'JSON', value: 'application/json' },
      { label: 'JSON (UTF-8)', value: 'application/json; charset=utf-8' },
      { label: 'JSON Lines (NDJSON)', value: 'application/x-ndjson' },
      { label: 'JSON Patch', value: 'application/json-patch+json' },
      { label: 'JSON API', value: 'application/vnd.api+json' },
      { label: 'Problem+JSON', value: 'application/problem+json' },
      { label: 'LD+JSON', value: 'application/ld+json' },
      { label: 'HAL+JSON', value: 'application/hal+json' }
    ]
  },
  {
    label: 'Text',
    types: [
      { label: 'Plain Text', value: 'text/plain' },
      { label: 'Plain Text (UTF-8)', value: 'text/plain; charset=utf-8' },
      { label: 'HTML', value: 'text/html' },
      { label: 'CSS', value: 'text/css' },
      { label: 'CSV', value: 'text/csv' },
      { label: 'Markdown', value: 'text/markdown' },
      { label: 'Calendar', value: 'text/calendar' },
      { label: 'XML (text)', value: 'text/xml' }
    ]
  },
  {
    label: 'XML',
    types: [
      { label: 'XML', value: 'application/xml' },
      { label: 'SOAP', value: 'application/soap+xml' },
      { label: 'Atom', value: 'application/atom+xml' },
      { label: 'RSS', value: 'application/rss+xml' },
      { label: 'XHTML', value: 'application/xhtml+xml' },
      { label: 'SVG', value: 'image/svg+xml' }
    ]
  },
  {
    label: 'JavaScript & Web',
    types: [
      { label: 'JavaScript', value: 'application/javascript' },
      { label: 'JavaScript (legacy)', value: 'application/x-javascript' },
      { label: 'ECMAScript', value: 'application/ecmascript' },
      { label: 'Form URL Encoded', value: 'application/x-www-form-urlencoded' },
      { label: 'GraphQL', value: 'application/graphql' },
      { label: 'GraphQL Response', value: 'application/graphql-response+json' }
    ]
  },
  {
    label: 'YAML & Config',
    types: [
      { label: 'YAML', value: 'application/yaml' },
      { label: 'YAML (alt)', value: 'application/x-yaml' },
      { label: 'YAML (text)', value: 'text/yaml' },
      { label: 'TOML', value: 'application/toml' }
    ]
  },
  {
    label: 'Binary & Serialization',
    types: [
      { label: 'Octet Stream', value: 'application/octet-stream' },
      { label: 'Protocol Buffers', value: 'application/protobuf' },
      { label: 'Protobuf (alt)', value: 'application/x-protobuf' },
      { label: 'MsgPack', value: 'application/msgpack' },
      { label: 'CBOR', value: 'application/cbor' },
      { label: 'Avro', value: 'application/avro' },
      { label: 'gRPC', value: 'application/grpc' },
      { label: 'gRPC+Proto', value: 'application/grpc+proto' }
    ]
  },
  {
    label: 'Documents',
    types: [
      { label: 'PDF', value: 'application/pdf' },
      { label: 'ZIP', value: 'application/zip' },
      { label: 'GZIP', value: 'application/gzip' },
      { label: 'Excel (.xls)', value: 'application/vnd.ms-excel' },
      { label: 'Excel (.xlsx)', value: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      { label: 'Word (.doc)', value: 'application/msword' },
      {
        label: 'Word (.docx)',
        value: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }
    ]
  },
  {
    label: 'Images',
    types: [
      { label: 'PNG', value: 'image/png' },
      { label: 'JPEG', value: 'image/jpeg' },
      { label: 'GIF', value: 'image/gif' },
      { label: 'WebP', value: 'image/webp' },
      { label: 'BMP', value: 'image/bmp' },
      { label: 'ICO', value: 'image/x-icon' },
      { label: 'TIFF', value: 'image/tiff' }
    ]
  },
  {
    label: 'Audio & Video',
    types: [
      { label: 'MP3', value: 'audio/mpeg' },
      { label: 'WAV', value: 'audio/wav' },
      { label: 'OGG', value: 'audio/ogg' },
      { label: 'MP4', value: 'video/mp4' },
      { label: 'WebM', value: 'video/webm' },
      { label: 'MPEG', value: 'video/mpeg' }
    ]
  },
  {
    label: 'Multipart',
    types: [
      { label: 'Form Data', value: 'multipart/form-data' },
      { label: 'Mixed', value: 'multipart/mixed' },
      { label: 'Related', value: 'multipart/related' }
    ]
  }
]

export interface GroupedContentTypeOption extends ContentTypeOption {
  group: string
}

export const CONTENT_TYPE_OPTIONS: GroupedContentTypeOption[] = CONTENT_TYPE_GROUPS.flatMap((g) =>
  g.types.map((t) => ({ ...t, group: g.label }))
)

export function isKnownContentType(value: string): boolean {
  return CONTENT_TYPE_OPTIONS.some((t) => t.value === value)
}

export function languageForContentType(contentType: string): string {
  const ct = contentType.toLowerCase().split(';')[0].trim()

  if (ct.includes('json') || ct.endsWith('+json')) return 'json'
  if (ct.includes('yaml') || ct === 'application/toml') return 'yaml'
  if (ct.includes('xml') || ct.includes('soap') || ct.includes('atom') || ct.includes('rss') || ct === 'text/xml')
    return 'xml'
  if (ct.includes('html') || ct.includes('xhtml')) return 'html'
  if (ct.includes('javascript') || ct.includes('ecmascript')) return 'javascript'
  if (ct.includes('css')) return 'css'
  if (ct.includes('markdown')) return 'markdown'

  return 'plaintext'
}

export function isJsonContentType(contentType: string): boolean {
  return languageForContentType(contentType) === 'json'
}

export function effectiveContentType(
  bodyType: 'none' | 'raw' | 'form-data' | 'x-www-form-urlencoded',
  bodyRawContentType: string
): string | null {
  switch (bodyType) {
    case 'raw':
      return bodyRawContentType || null
    case 'x-www-form-urlencoded':
      return 'application/x-www-form-urlencoded'
    case 'form-data':
      return 'multipart/form-data'
    default:
      return null
  }
}
