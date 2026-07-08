import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  Chip,
  Alert,
  Paper,
  Stack,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import AddIcon from '@mui/icons-material/Add'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon from '@mui/icons-material/Check'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { useCallback, useEffect, useState } from 'react'
import type { MockFileDisposition, MockResponseType, MockRoute, MockServerState } from '@shared/types'
import { useAppStore } from '../../stores/appStore'
import { COMPACT } from '../../theme/compact'

interface Props {
  open: boolean
  onClose: () => void
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'ANY'] as const

const METHOD_COLORS: Record<string, string> = {
  GET: '#61affe',
  POST: '#49cc90',
  PUT: '#fca130',
  PATCH: '#50e3c2',
  DELETE: '#f93e3e',
  HEAD: '#9012fe',
  OPTIONS: '#0d5aa7',
  ANY: '#737373'
}

const EMPTY_FORM = {
  method: 'GET',
  path: '/api/hello',
  statusCode: '200',
  body: '{"ok":true}',
  responseType: 'json' as MockResponseType,
  filePath: '',
  fileDisposition: 'auto' as MockFileDisposition
}

const FILE_DISPOSITIONS: { value: MockFileDisposition; label: string }[] = [
  { value: 'auto', label: 'Auto (open PDF/image in browser)' },
  { value: 'inline', label: 'Open in browser' },
  { value: 'attachment', label: 'Force download' }
]

const RESPONSE_TYPES: { value: MockResponseType; label: string }[] = [
  { value: 'json', label: 'JSON' },
  { value: 'text', label: 'Text' },
  { value: 'file', label: 'File' }
]

function tryBeautifyJson(body: string): string {
  const trimmed = body.trim()
  if (!trimmed) return body
  return JSON.stringify(JSON.parse(trimmed), null, 2)
}

function routePreview(route: MockRoute): string {
  if (route.responseType === 'file') {
    return route.filePath ? `File: ${route.filePath.split(/[/\\]/).pop()}` : 'File (not set)'
  }
  return route.body
}

function routePayload(
  method: string,
  path: string,
  statusCode: string,
  body: string,
  responseType: MockResponseType,
  filePath: string,
  fileDisposition: MockFileDisposition
) {
  return {
    method,
    path,
    statusCode: parseInt(statusCode, 10) || 200,
    body: responseType === 'file' ? '' : body,
    responseType,
    filePath: responseType === 'file' ? filePath : undefined,
    fileDisposition: responseType === 'file' ? fileDisposition : undefined,
    headers: {}
  }
}

function formatStartError(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code?: string }).code)
    if (code === 'EADDRINUSE') return 'Port is already in use. Choose another port.'
    if (code === 'EACCES') return 'Permission denied for this port. Try a port above 1024.'
  }
  return err instanceof Error ? err.message : 'Failed to start mock server'
}

function MethodChip({ method }: { method: string }) {
  const color = METHOD_COLORS[method.toUpperCase()] || METHOD_COLORS.ANY
  return (
    <Chip
      label={method.toUpperCase()}
      size="small"
      sx={{
        height: 20,
        fontSize: 10,
        fontWeight: 700,
        bgcolor: color,
        color: '#fff',
        '& .MuiChip-label': { px: 0.75 }
      }}
    />
  )
}

export default function MockServerDialog({ open, onClose }: Props) {
  const refreshMockServerState = useAppStore((s) => s.refreshMockServerState)
  const [state, setState] = useState<MockServerState>({
    running: false,
    port: 0,
    baseUrl: '',
    routes: []
  })
  const [port, setPort] = useState('4010')
  const [method, setMethod] = useState(EMPTY_FORM.method)
  const [path, setPath] = useState(EMPTY_FORM.path)
  const [statusCode, setStatusCode] = useState(EMPTY_FORM.statusCode)
  const [body, setBody] = useState(EMPTY_FORM.body)
  const [responseType, setResponseType] = useState<MockResponseType>(EMPTY_FORM.responseType)
  const [filePath, setFilePath] = useState(EMPTY_FORM.filePath)
  const [fileDisposition, setFileDisposition] = useState<MockFileDisposition>(EMPTY_FORM.fileDisposition)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const syncGlobalState = useCallback(
    async (next?: MockServerState) => {
      if (next) {
        setState(next)
      } else {
        setState(await window.lisek.mock.getState())
      }
      await refreshMockServerState()
    },
    [refreshMockServerState]
  )

  const resetForm = useCallback(() => {
    setEditingId(null)
    setMethod(EMPTY_FORM.method)
    setPath(EMPTY_FORM.path)
    setStatusCode(EMPTY_FORM.statusCode)
    setBody(EMPTY_FORM.body)
    setResponseType(EMPTY_FORM.responseType)
    setFilePath(EMPTY_FORM.filePath)
    setFileDisposition(EMPTY_FORM.fileDisposition)
  }, [])

  useEffect(() => {
    if (open) {
      setError(null)
      void syncGlobalState()
    }
  }, [open, syncGlobalState])

  const startEdit = (route: MockRoute) => {
    setEditingId(route.id)
    setMethod(route.method)
    setPath(route.path)
    setStatusCode(String(route.statusCode))
    setBody(route.body)
    setResponseType(route.responseType || 'json')
    setFilePath(route.filePath || '')
    setFileDisposition(route.fileDisposition || 'auto')
    setError(null)
  }

  const openInBrowser = (route: MockRoute) => {
    if (!state.running) return
    void window.lisek.shell.openExternal(`${state.baseUrl}${route.path}`)
  }

  const pickFile = async () => {
    try {
      const path = await window.lisek.dialog.openFile()
      if (path) {
        setFilePath(path)
        setError(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open file picker')
    }
  }

  const beautifyJson = () => {
    try {
      setBody(tryBeautifyJson(body))
      setError(null)
    } catch {
      setError('Invalid JSON. Fix syntax before beautifying.')
    }
  }

  const saveRoute = async () => {
    setError(null)
    if (responseType === 'file' && !filePath.trim()) {
      setError('Select a file for file responses.')
      return
    }
    setBusy(true)
    try {
      const payload = routePayload(method, path, statusCode, body, responseType, filePath, fileDisposition)
      if (editingId) {
        await syncGlobalState(await window.lisek.mock.updateRoute(editingId, payload))
      } else {
        await syncGlobalState(await window.lisek.mock.addRoute(payload))
      }
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save route')
    } finally {
      setBusy(false)
    }
  }

  const startServer = async () => {
    setError(null)
    setBusy(true)
    try {
      const seedRoute =
        state.routes.length === 0
          ? routePayload(method, path, statusCode, body, responseType, filePath, fileDisposition)
          : undefined
      const next = await window.lisek.mock.start(parseInt(port, 10) || 4010, seedRoute, true)
      if (next.port) setPort(String(next.port))
      await syncGlobalState(next)
    } catch (err) {
      setError(formatStartError(err))
      await syncGlobalState()
    } finally {
      setBusy(false)
    }
  }

  const stopServer = async () => {
    setError(null)
    setBusy(true)
    try {
      await syncGlobalState(await window.lisek.mock.stop())
    } finally {
      setBusy(false)
    }
  }

  const copyUrl = async (route: MockRoute) => {
    if (!state.running) return
    await window.lisek.clipboard.writeText(`${state.baseUrl}${route.path}`)
    setCopiedId(route.id)
    window.setTimeout(() => setCopiedId(null), 1200)
  }

  const removeRoute = async (id: string) => {
    if (editingId === id) resetForm()
    await syncGlobalState(await window.lisek.mock.removeRoute(id))
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth disableEnforceFocus>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1, pb: 1 }}>
        <Box>
          <Typography variant="h6" fontWeight={600} lineHeight={1.2}>
            Mock Server
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Local HTTP server for stub responses
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 1.5 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Paper
          variant="outlined"
          sx={{
            p: 1.25,
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
            bgcolor: (theme) =>
              state.running
                ? theme.palette.mode === 'dark'
                  ? 'rgba(46, 125, 50, 0.16)'
                  : 'rgba(46, 125, 50, 0.08)'
                : theme.palette.action.hover,
            borderColor: state.running ? 'success.light' : 'divider'
          }}
        >
          <FiberManualRecordIcon
            sx={{
              fontSize: 12,
              color: state.running ? 'success.main' : 'text.disabled',
              animation: state.running ? 'mockStatusPulse 1.4s ease-in-out infinite' : 'none',
              '@keyframes mockStatusPulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.35 }
              }
            }}
          />
          <Box sx={{ flex: 1, minWidth: 120 }}>
            <Typography variant="body2" fontWeight={600} lineHeight={1.2}>
              {state.running ? 'Running' : 'Stopped'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {state.running
                ? `${state.baseUrl} · ${state.routes.length} route${state.routes.length === 1 ? '' : 's'}`
                : 'Start the server to accept requests'}
            </Typography>
          </Box>
          <TextField
            size="small"
            label="Port"
            value={port}
            disabled={state.running || busy}
            onChange={(e) => setPort(e.target.value)}
            sx={{ width: 88, ...COMPACT.input }}
          />
          {!state.running ? (
            <Button
              size="small"
              variant="contained"
              startIcon={<PlayArrowIcon />}
              disabled={busy}
              onClick={() => void startServer()}
            >
              Start
            </Button>
          ) : (
            <Button
              size="small"
              color="warning"
              variant="contained"
              startIcon={<StopIcon />}
              disabled={busy}
              onClick={() => void stopServer()}
            >
              Stop
            </Button>
          )}
        </Paper>

        <Typography variant="subtitle2" sx={{ mb: 1, fontSize: 12 }}>
          Routes ({state.routes.length})
        </Typography>

        <Stack spacing={0.75} sx={{ mb: 2, maxHeight: 220, overflow: 'auto' }}>
          {state.routes.length === 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ px: 0.5, py: 1 }}>
              No routes yet. Add one below or click Start to register the default route.
            </Typography>
          )}
          {state.routes.map((route) => (
            <Paper
              key={route.id}
              variant="outlined"
              sx={{
                p: 1,
                borderColor: editingId === route.id ? 'primary.main' : 'divider',
                bgcolor: editingId === route.id ? 'action.selected' : 'background.paper'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Stack spacing={0.5} alignItems="flex-start">
                  <MethodChip method={route.method} />
                  <Chip
                    label={(route.responseType || 'json').toUpperCase()}
                    size="small"
                    variant="outlined"
                    sx={{ height: 18, fontSize: 9, fontWeight: 600 }}
                  />
                </Stack>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    fontFamily="Consolas, monospace"
                    fontSize={12}
                    noWrap
                    title={route.path}
                  >
                    {route.path}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    HTTP {route.statusCode}
                    {state.running ? ` · ${state.baseUrl}${route.path}` : ''}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: 'block',
                      fontFamily: 'Consolas, monospace',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {routePreview(route)}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.25}>
                  <Tooltip title="Edit route">
                    <IconButton size="small" onClick={() => startEdit(route)}>
                      <EditOutlinedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  {state.running && (
                    <Tooltip title="Open in browser">
                      <IconButton size="small" onClick={() => openInBrowser(route)}>
                        <OpenInNewIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {state.running && (
                    <Tooltip title={copiedId === route.id ? 'Copied!' : 'Copy URL'}>
                      <IconButton size="small" onClick={() => void copyUrl(route)}>
                        {copiedId === route.id ? (
                          <CheckIcon sx={{ fontSize: 16, color: 'success.main' }} />
                        ) : (
                          <ContentCopyIcon sx={{ fontSize: 16 }} />
                        )}
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Delete route">
                    <IconButton size="small" color="error" onClick={() => void removeRoute(route.id)}>
                      <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Box>
            </Paper>
          ))}
        </Stack>

        <Divider sx={{ mb: 1.5 }} />

        <Typography variant="subtitle2" sx={{ mb: 1, fontSize: 12 }}>
          {editingId ? 'Edit route' : 'New route'}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 96, ...COMPACT.input }}>
            <InputLabel sx={{ fontSize: 11 }}>Method</InputLabel>
            <Select
              label="Method"
              value={method}
              onChange={(e) => setMethod(String(e.target.value))}
              sx={{ fontSize: 11, height: 28 }}
            >
              {HTTP_METHODS.map((m) => (
                <MenuItem key={m} value={m} sx={{ fontSize: 12 }}>
                  {m}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Path"
            fullWidth
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/api/hello"
            sx={{ flex: 1, minWidth: 160, ...COMPACT.input }}
          />
          <TextField
            size="small"
            label="Status"
            value={statusCode}
            onChange={(e) => setStatusCode(e.target.value)}
            sx={{ width: 80, ...COMPACT.input }}
          />
          <FormControl size="small" sx={{ minWidth: 96, ...COMPACT.input }}>
            <InputLabel sx={{ fontSize: 11 }}>Output</InputLabel>
            <Select
              label="Output"
              value={responseType}
              onChange={(e) => setResponseType(e.target.value as MockResponseType)}
              sx={{ fontSize: 11, height: 28 }}
            >
              {RESPONSE_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value} sx={{ fontSize: 12 }}>
                  {t.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {responseType === 'file' ? (
          <Box sx={{ mb: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 1 }}>
              <Button size="small" variant="outlined" startIcon={<UploadFileIcon />} onClick={() => void pickFile()}>
                Choose file
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'Consolas, monospace' }}>
                {filePath || 'No file selected'}
              </Typography>
            </Stack>
            <FormControl size="small" fullWidth sx={{ mb: 1, ...COMPACT.input }}>
              <InputLabel sx={{ fontSize: 11 }}>Browser behavior</InputLabel>
              <Select
                label="Browser behavior"
                value={fileDisposition}
                onChange={(e) => setFileDisposition(e.target.value as MockFileDisposition)}
                sx={{ fontSize: 11, height: 28 }}
              >
                {FILE_DISPOSITIONS.map((item) => (
                  <MenuItem key={item.value} value={item.value} sx={{ fontSize: 12 }}>
                    {item.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Pick a file, click Add route, then Start. Open the URL with{' '}
              <Box component="span" sx={{ fontFamily: 'monospace' }}>
                http://127.0.0.1:{port || '4010'}/your-path
              </Box>
            </Typography>
          </Box>
        ) : (
          <>
            <TextField
              size="small"
              label={responseType === 'json' ? 'JSON body' : 'Response body'}
              fullWidth
              multiline
              minRows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              sx={{
                mb: 1,
                '& .MuiInputBase-input': { fontFamily: 'Consolas, monospace', fontSize: 12 }
              }}
            />
            {responseType === 'json' && (
              <Button
                size="small"
                startIcon={<AutoFixHighIcon />}
                onClick={beautifyJson}
                sx={{ mb: 1.5 }}
              >
                Beautify JSON
              </Button>
            )}
          </>
        )}

        <Stack direction="row" spacing={1} sx={{ mb: responseType === 'json' ? 0 : 1.5 }}>
          <Button
            size="small"
            variant="contained"
            startIcon={editingId ? <CheckIcon /> : <AddIcon />}
            disabled={busy || !path.trim() || (responseType === 'file' ? !filePath.trim() : !body.trim())}
            onClick={() => void saveRoute()}
          >
            {editingId ? 'Save changes' : 'Add route'}
          </Button>
          {editingId && (
            <Button size="small" onClick={resetForm} disabled={busy}>
              Cancel edit
            </Button>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
