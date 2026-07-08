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
import CloseIcon from '@mui/icons-material/Close'
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
import SseTab from './SseTab'
import ScriptsTab from './ScriptsTab'
import ConfirmDialog from '../../components/ConfirmDialog'
import { resolveCollectionVariables } from '@shared/collectionVariables'
import VariableInput from '../../components/VariableInput'
import { COMPACT } from '../../theme/compact'
import { applyControlledInputChange } from '../../utils/inputSelection'
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
const PROTOCOLS: Protocol[] = ['http', 'graphql', 'websocket', 'sse', 'grpc']

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
          sx={{
            height: 16,
            minWidth: 16,
            fontSize: 9,
            bgcolor: 'primary.main',
            color: '#fff',
            '& .MuiChip-label': { px: 0.5, color: '#fff' }
          }}
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
      startIcon={<SendIcon sx={{ fontSize: 16 }} />}
      onClick={onSend}
      sx={{
        px: 2,
        py: 0.625,
        fontSize: 12,
        fontWeight: 600,
        textTransform: 'none',
        borderRadius: 1.5,
        boxShadow: 'none',
        flexShrink: 0,
        '&:hover': {
          boxShadow: (t) =>
            t.palette.mode === 'dark'
              ? '0 2px 12px rgba(192, 132, 252, 0.35)'
              : '0 2px 8px rgba(86, 0, 114, 0.25)'
        }
      }}
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
        : request.protocol === 'sse'
          ? 'SSE'
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
    if (id) await window.lisek.request.cancel(id)
    useAppStore.setState({ loading: false })
  }, [])

  const handleUrlEnter = useCallback(() => {
    void handleSend()
  }, [handleSend])

  const handleUrlFieldKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void handleSend()
      }
    },
    [handleSend]
  )

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
    <Box sx={{ p: 1, height: '100%', display: 'flex', flexDirection: 'column' }} onKeyDown={handleKeyDown}>
      <Box
        sx={{
          display: 'flex',
          gap: 0.75,
          mb: 1,
          alignItems: 'center',
          flexWrap: 'nowrap',
          flexShrink: 0
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
                '.MuiSvgIcon-root': { color: '#fff' },
                '.MuiSelect-select': { color: '#fff !important' }
              }}
            >
              {METHODS.map((m) => (
                <MenuItem key={m} value={m} sx={{ fontSize: 11 }}>
                  {m}
                </MenuItem>
              ))}
            </Select>
            <VariableInput
              syncKey={request.id}
              value={request.url}
              onChange={patchUrl}
              onEnter={handleUrlEnter}
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
            onChange={(e) =>
              applyControlledInputChange(e.target, request.wsUrl, e.target.value, (v) => patch({ wsUrl: v }))
            }
            onKeyDown={handleUrlFieldKeyDown}
            sx={COMPACT.input}
          />
        ) : request.protocol === 'sse' ? (
          <TextField
            size="small"
            fullWidth
            placeholder="https://api.example.com/events"
            value={request.sseUrl}
            onChange={(e) =>
              applyControlledInputChange(e.target, request.sseUrl, e.target.value, (v) => patch({ sseUrl: v, url: v }))
            }
            onKeyDown={handleUrlFieldKeyDown}
            sx={COMPACT.input}
          />
        ) : (
          <TextField
            size="small"
            fullWidth
            placeholder="localhost:50051"
            value={request.grpcTarget}
            onChange={(e) =>
              applyControlledInputChange(e.target, request.grpcTarget, e.target.value, (v) =>
                patch({ grpcTarget: v })
              )
            }
            onKeyDown={handleUrlFieldKeyDown}
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

      <Box sx={{ display: 'flex', gap: 1, mb: 0.75, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          label="Tags"
          placeholder="smoke, api"
          value={(request.tags || []).join(', ')}
          onChange={(e) =>
            patch({
              tags: e.target.value
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
            })
          }
          sx={{ minWidth: 140, flex: 1, ...COMPACT.input }}
        />
        <TextField
          size="small"
          label="Notes"
          placeholder="Request notes"
          value={request.notes || ''}
          onChange={(e) => patch({ notes: e.target.value })}
          sx={{ minWidth: 180, flex: 2, ...COMPACT.input }}
        />
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

      <RequestTabPanel sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
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
        {section === 'protocol' && request.protocol === 'sse' && <SseTab />}
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

function RequestTabBar() {
  const tabs = useAppStore((s) => s.requestTabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const switchTab = useAppStore((s) => s.switchTab)
  const closeTab = useAppStore((s) => s.closeTab)

  if (tabs.length === 0) return null

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        borderBottom: 1,
        borderColor: 'divider',
        overflow: 'auto',
        flexShrink: 0,
        bgcolor: 'background.paper'
      }}
    >
      {tabs.map((tab) => {
        const active = tab.tabId === activeTabId
        return (
          <Box
            key={tab.tabId}
            onClick={() => void switchTab(tab.tabId)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.5,
              cursor: 'pointer',
              borderRight: 1,
              borderColor: 'divider',
              bgcolor: active ? 'action.selected' : 'transparent',
              maxWidth: 200,
              '&:hover': { bgcolor: active ? 'action.selected' : 'action.hover' }
            }}
          >
            <Typography
              variant="caption"
              noWrap
              sx={{ fontWeight: active ? 700 : 500, fontSize: 11, flex: 1 }}
            >
              {tab.request.name || 'Untitled'}
            </Typography>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation()
                closeTab(tab.tabId)
              }}
              sx={{ p: 0.25 }}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        )
      })}
    </Box>
  )
}

function RequestBuilderShell() {
  const hasActiveRequest = useAppStore((s) => s.activeRequest !== null)
  const requestId = useAppStore((s) => s.activeRequest?.id)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const requestCreatedAt = useAppStore((s) => s.activeRequest?.createdAt ?? 0)
  const tabs = useAppStore((s) => s.requestTabs)
  const collectionId = useAppStore((s) => s.activeRequest?.collectionId)
  const deleteRequest = useAppStore((s) => s.deleteRequest)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteName, setDeleteName] = useState('')

  const collections = useAppStore((s) => s.collections)
  const collectionVariables = useMemo(
    () => resolveCollectionVariables(collectionId, collections),
    [collectionId, collections]
  )

  const openDeleteDialog = useCallback(() => {
    setDeleteName(useAppStore.getState().activeRequest?.name ?? '')
    setDeleteOpen(true)
  }, [])

  const handleDelete = useCallback(async () => {
    if (requestId) await deleteRequest(requestId)
    setDeleteOpen(false)
  }, [deleteRequest, requestId])

  if (!hasActiveRequest && tabs.length === 0) {
    return (
      <Box sx={{ p: 1.5, textAlign: 'center' }}>
        <Typography sx={COMPACT.caption}>Select or create a request</Typography>
      </Box>
    )
  }

  const editorKey = requestId || `new-${requestCreatedAt}`
  const tabId = activeTabId || editorKey

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <RequestTabBar />
      {hasActiveRequest ? (
        <>
          <RequestEditorProvider key={editorKey} tabId={tabId} requestId={editorKey}>
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
      ) : (
        <Box sx={{ p: 1.5, textAlign: 'center', flex: 1 }}>
          <Typography sx={COMPACT.caption}>Select a tab or create a request</Typography>
        </Box>
      )}
    </Box>
  )
}

export default memo(RequestBuilderShell)
