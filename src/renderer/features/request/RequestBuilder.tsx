import {
  Box,
  Tabs,
  Tab,
  TextField,
  Select,
  MenuItem,
  Button,
  Typography,
  Tooltip,
  IconButton,
  Snackbar,
  Alert,
  Chip,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import SendIcon from '@mui/icons-material/Send'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import CodeEditor from '../../components/CodeEditor'
import ContentTypeSelect from '../../components/ContentTypeSelect'
import { effectiveContentType, isJsonContentType, languageForContentType } from '../../utils/contentTypes'
import { readContentTypeHeader, upsertContentTypeHeader } from '../../utils/requestHeaders'
import { useAppStore } from '../../stores/appStore'
import { RequestEditorProvider, useRequestEditor } from '../../contexts/RequestEditorContext'
import KeyValueEditor from '../../components/KeyValueEditor'
import RequestTabPanel from '../../components/RequestTabPanel'
import AuthTab from './AuthTab'
import WebSocketTab from './WebSocketTab'
import GraphQLTab from './GraphQLTab'
import GrpcTab from './GrpcTab'
import ScriptsTab from './ScriptsTab'
import ConfirmDialog from '../../components/ConfirmDialog'
import VariableInput from '../../components/VariableInput'
import { COMPACT } from '../../theme/compact'
import type { BodyType, HttpMethod, KeyValue, Protocol } from '@shared/types'

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: '#61affe',
  POST: '#49cc90',
  PUT: '#fca130',
  PATCH: '#50e3c2',
  DELETE: '#f93e3e',
  HEAD: '#9012fe',
  OPTIONS: '#0d5aa7'
}

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
const PROTOCOLS: Protocol[] = ['http', 'graphql', 'websocket', 'grpc']
const EMPTY_VARS: KeyValue[] = []

type RequestSection = 'params' | 'headers' | 'body' | 'auth' | 'scripts' | 'protocol'

function countActive(items: KeyValue[]) {
  return items.filter((i) => i.enabled && i.key.trim()).length
}

function TabLabel({ label, count }: { label: string; count?: number }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.375 }}>
      {label}
      {count !== undefined && count > 0 && (
        <Chip
          label={count}
          size="small"
          color="primary"
          sx={{ height: 16, minWidth: 16, fontSize: 9, '& .MuiChip-label': { px: 0.5 } }}
        />
      )}
    </Box>
  )
}

const SendButton = memo(function SendButton({
  onSend,
  onCancel
}: {
  onSend: () => void
  onCancel: () => void
}) {
  const loading = useAppStore((s) => s.loading)

  if (loading) {
    return (
      <Button variant="outlined" color="warning" size="small" onClick={onCancel} sx={COMPACT.btnSmall}>
        Cancel
      </Button>
    )
  }

  return (
    <Button
      variant="contained"
      color="primary"
      size="small"
      startIcon={<SendIcon sx={COMPACT.icon} />}
      onClick={onSend}
      sx={COMPACT.btnSmall}
    >
      Send
    </Button>
  )
})

function RequestBuilderForm({
  collectionVariables,
  onDelete
}: {
  collectionVariables: KeyValue[]
  onDelete: () => void
}) {
  const { request, patch, flush } = useRequestEditor()
  const sendRequest = useAppStore((s) => s.sendRequest)
  const snippetOpen = useAppStore((s) => s.snippetOpen)
  const [section, setSection] = useState<RequestSection>('params')
  const [jsonFormatError, setJsonFormatError] = useState<string | null>(null)

  const paramCount = useMemo(() => countActive(request.params), [request.params])
  const headerCount = useMemo(() => countActive(request.headers), [request.headers])
  const hasAuth = request.authType !== 'none'
  const hasScripts = !!(request.preRequestScript.trim() || request.testScript.trim())

  const protocolTabLabel =
    request.protocol === 'graphql'
      ? 'GraphQL'
      : request.protocol === 'websocket'
        ? 'WebSocket'
        : request.protocol === 'grpc'
          ? 'gRPC'
          : null

  useEffect(() => {
    if (snippetOpen) flush()
  }, [snippetOpen, flush])

  useEffect(() => {
    if (request.bodyType !== 'none') setSection('body')
  }, [request.id, request.bodyType])

  const handleSend = useCallback(async () => {
    flush()
    await sendRequest()
  }, [flush, sendRequest])

  const handleCancel = useCallback(async () => {
    const id = useAppStore.getState().activeRequest?.id
    if (id) await window.fluxAPI.request.cancel(id)
    useAppStore.setState({ loading: false })
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') void handleSend()
    },
    [handleSend]
  )

  const patchUrl = useCallback((url: string) => patch({ url }), [patch])
  const patchParams = useCallback((params: KeyValue[]) => patch({ params }), [patch])
  const patchHeaders = useCallback(
    (headers: KeyValue[]) => {
      const contentType = readContentTypeHeader(headers)
      patch({
        headers,
        ...(request.bodyType === 'raw' && contentType !== undefined
          ? { bodyRawContentType: contentType }
          : {})
      })
    },
    [patch, request.bodyType]
  )
  const patchFormData = useCallback((formData: KeyValue[]) => patch({ formData }), [patch])
  const patchUrlEncoded = useCallback((urlEncoded: KeyValue[]) => patch({ urlEncoded }), [patch])
  const patchBodyRaw = useCallback((bodyRaw: string) => patch({ bodyRaw }), [patch])
  const patchBodyContentType = useCallback(
    (bodyRawContentType: string) => {
      patch({
        bodyRawContentType,
        headers: upsertContentTypeHeader(request.headers, bodyRawContentType)
      })
    },
    [patch, request.headers]
  )

  const contentTypeValue = effectiveContentType(request.bodyType, request.bodyRawContentType)
  const showContentTypeInHeaders = request.bodyType !== 'none'

  const formatBodyJson = useCallback(() => {
    const raw = request.bodyRaw.trim()
    if (!raw) {
      setJsonFormatError('Body is empty')
      return
    }
    try {
      const parsed = JSON.parse(raw)
      patch({ bodyRaw: JSON.stringify(parsed, null, 2) })
      setJsonFormatError(null)
    } catch {
      setJsonFormatError('Invalid JSON — cannot format')
    }
  }, [request.bodyRaw, patch])

  const isJsonBody = isJsonContentType(request.bodyRawContentType)
  const bodyLanguage = languageForContentType(request.bodyRawContentType)

  return (
    <Box sx={{ p: 0.5 }} onKeyDown={handleKeyDown}>
      <Box
        sx={{
          display: 'flex',
          gap: 0.5,
          mb: 0.5,
          alignItems: 'center',
          flexWrap: 'wrap',
          ...COMPACT.bar
        }}
      >
        <Select
          size="small"
          value={request.protocol}
          onChange={(e) => patch({ protocol: e.target.value as Protocol })}
          sx={{ minWidth: 72, ...COMPACT.select }}
        >
          {PROTOCOLS.map((p) => (
            <MenuItem key={p} value={p} sx={{ fontSize: 11 }}>
              {p.toUpperCase()}
            </MenuItem>
          ))}
        </Select>
        {request.protocol === 'http' || request.protocol === 'graphql' ? (
          <>
            <Select
              size="small"
              value={request.method}
              onChange={(e) => patch({ method: e.target.value as HttpMethod })}
              sx={{
                minWidth: 72,
                ...COMPACT.select,
                bgcolor: METHOD_COLORS[request.method],
                color: '#fff',
                fontWeight: 700,
                '.MuiOutlinedInput-notchedOutline': { border: 'none' },
                '.MuiSvgIcon-root': { color: '#fff' }
              }}
            >
              {METHODS.map((m) => (
                <MenuItem key={m} value={m} sx={{ fontSize: 11 }}>
                  {m}
                </MenuItem>
              ))}
            </Select>
            <VariableInput
              value={request.url}
              onChange={patchUrl}
              placeholder="https://api.example.com or {{baseUrl}}/path"
              collectionVariables={collectionVariables}
            />
          </>
        ) : request.protocol === 'websocket' ? (
          <TextField
            size="small"
            fullWidth
            placeholder="ws://localhost:8080"
            value={request.wsUrl}
            onChange={(e) => patch({ wsUrl: e.target.value })}
            sx={COMPACT.input}
          />
        ) : (
          <TextField
            size="small"
            fullWidth
            placeholder="localhost:50051"
            value={request.grpcTarget}
            onChange={(e) => patch({ grpcTarget: e.target.value })}
            sx={COMPACT.input}
          />
        )}
        <SendButton onSend={handleSend} onCancel={() => void handleCancel()} />
        {request.id && (
          <Tooltip title="Delete request">
            <IconButton color="error" onClick={onDelete} sx={COMPACT.iconBtn}>
              <DeleteOutlineIcon sx={COMPACT.icon} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Tabs
        value={section}
        onChange={(_, v: RequestSection) => setSection(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          minHeight: 28,
          borderBottom: 1,
          borderColor: 'divider',
          '& .MuiTabs-indicator': { height: 2 },
          '& .MuiTab-root': COMPACT.tabRoot
        }}
      >
        <Tab value="params" label={<TabLabel label="Params" count={paramCount} />} />
        <Tab value="headers" label={<TabLabel label="Headers" count={headerCount} />} />
        <Tab value="body" label="Body" />
        <Tab value="auth" label={<TabLabel label="Auth" count={hasAuth ? 1 : 0} />} />
        <Tab value="scripts" label={<TabLabel label="Scripts" count={hasScripts ? 1 : 0} />} />
        {protocolTabLabel && <Tab value="protocol" label={protocolTabLabel} />}
      </Tabs>

      <RequestTabPanel>
        {section === 'params' && (
          <KeyValueEditor
            items={request.params}
            onChange={patchParams}
            keyLabel="Param"
            description="Query string parameters appended to the URL."
            emptyTitle="No query parameters"
            emptyHint="Add params like page, limit, or filter"
            keyPlaceholder="param_name"
            valuePlaceholder="value or {{var}}"
          />
        )}

        {section === 'headers' && (
          <Box>
            {showContentTypeInHeaders && (
              <Box sx={{ mb: 1, pb: 1, borderBottom: 1, borderColor: 'divider' }}>
                {request.bodyType === 'raw' ? (
                  <ContentTypeSelect
                    value={request.bodyRawContentType}
                    onChange={patchBodyContentType}
                  />
                ) : (
                  <Box>
                    <Typography sx={{ ...COMPACT.caption, display: 'block', mb: 0.25 }}>
                      Content-Type
                    </Typography>
                    <Chip
                      label={contentTypeValue}
                      size="small"
                      variant="outlined"
                      sx={{ fontFamily: 'Consolas, monospace', fontSize: 10, height: 20 }}
                    />
                  </Box>
                )}
              </Box>
            )}
            <KeyValueEditor
              items={request.headers}
              onChange={patchHeaders}
              keyPlaceholder="Header-Name"
              valuePlaceholder="value or {{var}}"
            />
          </Box>
        )}

        {section === 'body' && (
          <Box>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={request.bodyType}
              onChange={(_, value: BodyType | null) => value && patch({ bodyType: value })}
              sx={{
                mb: 1,
                flexWrap: 'wrap',
                gap: 0.25,
                '& .MuiToggleButtonGroup-grouped': {
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: '4px !important',
                  mx: '0 !important',
                  px: 0.75,
                  py: 0.125,
                  textTransform: 'none',
                  fontWeight: 500,
                  fontSize: 10,
                  lineHeight: 1.3
                }
              }}
            >
              <ToggleButton value="none">None</ToggleButton>
              <ToggleButton value="raw">Raw</ToggleButton>
              <ToggleButton value="form-data">Form</ToggleButton>
              <ToggleButton value="x-www-form-urlencoded">URL Enc</ToggleButton>
            </ToggleButtonGroup>

            {request.bodyType === 'none' && (
              <Box
                sx={{
                  py: 1.5,
                  px: 1,
                  textAlign: 'center',
                  border: 1,
                  borderStyle: 'dashed',
                  borderColor: 'divider',
                  borderRadius: 0.75,
                  bgcolor: 'action.hover'
                }}
              >
                <Typography sx={COMPACT.caption}>No body (typical for GET, HEAD, DELETE)</Typography>
              </Box>
            )}

            {request.bodyType === 'raw' && (
              <>
                {isJsonBody && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.25 }}>
                    <Tooltip title="Format JSON">
                      <IconButton
                        size="small"
                        onClick={formatBodyJson}
                        disabled={!request.bodyRaw.trim()}
                        sx={COMPACT.iconBtn}
                      >
                        <AutoFixHighIcon sx={COMPACT.icon} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
                <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 0.75, overflow: 'hidden' }}>
                  <CodeEditor
                    editorKey={`${request.id}-body-${bodyLanguage}`}
                    height="160px"
                    language={bodyLanguage}
                    value={request.bodyRaw}
                    onChange={patchBodyRaw}
                  />
                </Box>
              </>
            )}

            {request.bodyType === 'form-data' && (
              <KeyValueEditor
                items={request.formData}
                onChange={patchFormData}
                allowFiles
                description="Multipart form fields. Attach files using the clip icon."
                emptyTitle="No form fields"
                emptyHint="Add text fields or file uploads"
                keyPlaceholder="field_name"
                valuePlaceholder="value"
              />
            )}

            {request.bodyType === 'x-www-form-urlencoded' && (
              <KeyValueEditor
                items={request.urlEncoded}
                onChange={patchUrlEncoded}
                description="URL-encoded key-value pairs in the request body."
                emptyTitle="No URL-encoded fields"
                emptyHint="Add application/x-www-form-urlencoded fields"
                keyPlaceholder="field_name"
                valuePlaceholder="value"
              />
            )}
          </Box>
        )}

        {section === 'auth' && <AuthTab />}
        {section === 'scripts' && <ScriptsTab />}
        {section === 'protocol' && request.protocol === 'graphql' && <GraphQLTab />}
        {section === 'protocol' && request.protocol === 'websocket' && <WebSocketTab />}
        {section === 'protocol' && request.protocol === 'grpc' && <GrpcTab />}
      </RequestTabPanel>

      <Snackbar
        open={!!jsonFormatError}
        autoHideDuration={4000}
        onClose={() => setJsonFormatError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setJsonFormatError(null)} sx={{ width: '100%' }}>
          {jsonFormatError}
        </Alert>
      </Snackbar>
    </Box>
  )
}

function RequestBuilderShell() {
  const hasActiveRequest = useAppStore((s) => s.activeRequest !== null)
  const requestId = useAppStore((s) => s.activeRequest?.id)
  const requestCreatedAt = useAppStore((s) => s.activeRequest?.createdAt ?? 0)
  const collectionId = useAppStore((s) => s.activeRequest?.collectionId)
  const deleteRequest = useAppStore((s) => s.deleteRequest)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteName, setDeleteName] = useState('')

  const collectionVariables = useAppStore((s) => {
    if (!collectionId) return EMPTY_VARS
    return s.collections.find((c) => c.id === collectionId)?.variables ?? EMPTY_VARS
  })

  const openDeleteDialog = useCallback(() => {
    setDeleteName(useAppStore.getState().activeRequest?.name ?? '')
    setDeleteOpen(true)
  }, [])

  if (!hasActiveRequest) {
    return (
      <Box sx={{ p: 1.5, textAlign: 'center' }}>
        <Typography sx={COMPACT.caption}>Select or create a request</Typography>
      </Box>
    )
  }

  const handleDelete = async () => {
    if (requestId) await deleteRequest(requestId)
    setDeleteOpen(false)
  }

  const editorKey = requestId || `new-${requestCreatedAt}`

  return (
    <>
      <RequestEditorProvider key={editorKey} requestId={editorKey}>
        <RequestBuilderForm collectionVariables={collectionVariables} onDelete={openDeleteDialog} />
      </RequestEditorProvider>
      <ConfirmDialog
        open={deleteOpen}
        title="Delete Request"
        message={`Delete "${deleteName}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </>
  )
}

export default memo(RequestBuilderShell)
