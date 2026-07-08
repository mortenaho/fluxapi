import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Chip,
  Alert
} from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import AddIcon from '@mui/icons-material/Add'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { useEffect, useState } from 'react'
import type { MockRoute, MockServerState } from '@shared/types'

interface Props {
  open: boolean
  onClose: () => void
}

function formatStartError(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code?: string }).code)
    if (code === 'EADDRINUSE') return 'Port is already in use. Choose another port.'
    if (code === 'EACCES') return 'Permission denied for this port. Try a port above 1024.'
  }
  return err instanceof Error ? err.message : 'Failed to start mock server'
}

export default function MockServerDialog({ open, onClose }: Props) {
  const [state, setState] = useState<MockServerState>({
    running: false,
    port: 0,
    baseUrl: '',
    routes: []
  })
  const [port, setPort] = useState('4010')
  const [method, setMethod] = useState('GET')
  const [path, setPath] = useState('/api/hello')
  const [statusCode, setStatusCode] = useState('200')
  const [body, setBody] = useState('{"ok":true}')
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    setState(await window.lisek.mock.getState())
  }

  useEffect(() => {
    if (open) {
      setError(null)
      void refresh()
    }
  }, [open])

  const addRoute = async () => {
    setError(null)
    await window.lisek.mock.addRoute({
      method,
      path,
      statusCode: parseInt(statusCode, 10) || 200,
      body,
      headers: { 'content-type': 'application/json' }
    })
    await refresh()
  }

  const startServer = async () => {
    setError(null)
    try {
      const next = await window.lisek.mock.start(parseInt(port, 10) || 0)
      setState(next)
      if (next.port) setPort(String(next.port))
    } catch (err) {
      setError(formatStartError(err))
      await refresh()
    }
  }

  const stopServer = async () => {
    setError(null)
    setState(await window.lisek.mock.stop())
  }

  const exampleUrl =
    state.running && state.routes[0]
      ? `${state.baseUrl}${state.routes[0].path}`
      : state.running
        ? `${state.baseUrl}/your-path`
        : ''

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Local Mock Server</DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
          <TextField size="small" label="Port" value={port} onChange={(e) => setPort(e.target.value)} sx={{ width: 100 }} />
          {!state.running ? (
            <Button startIcon={<PlayArrowIcon />} variant="contained" onClick={() => void startServer()}>
              Start
            </Button>
          ) : (
            <Button startIcon={<StopIcon />} color="warning" onClick={() => void stopServer()}>
              Stop
            </Button>
          )}
          {state.running && <Chip label={state.baseUrl} size="small" color="success" />}
          {exampleUrl && (
            <Button
              size="small"
              startIcon={<ContentCopyIcon />}
              onClick={() => void navigator.clipboard.writeText(exampleUrl)}
            >
              Copy example URL
            </Button>
          )}
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          Add routes first, then start the server. Request the full URL in Lisek, e.g.{' '}
          <Box component="span" sx={{ fontFamily: 'monospace' }}>
            http://127.0.0.1:4010/api/hello
          </Box>
          .
        </Typography>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Routes
        </Typography>
        <List dense disablePadding sx={{ mb: 2, maxHeight: 180, overflow: 'auto' }}>
          {state.routes.length === 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
              No routes yet.
            </Typography>
          )}
          {state.routes.map((route: MockRoute) => (
            <ListItem
              key={route.id}
              secondaryAction={
                <IconButton edge="end" size="small" onClick={() => void window.lisek.mock.removeRoute(route.id).then(refresh)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              }
            >
              <ListItemText
                primary={`${route.method} ${route.path}`}
                secondary={
                  state.running
                    ? `${route.statusCode} · ${state.baseUrl}${route.path}`
                    : `${route.statusCode} · ${route.body.slice(0, 60)}`
                }
              />
            </ListItem>
          ))}
        </List>

        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <TextField size="small" label="Method" value={method} onChange={(e) => setMethod(e.target.value.toUpperCase())} sx={{ width: 90 }} />
          <TextField size="small" label="Path" fullWidth value={path} onChange={(e) => setPath(e.target.value)} placeholder="/api/hello" />
          <TextField size="small" label="Status" value={statusCode} onChange={(e) => setStatusCode(e.target.value)} sx={{ width: 80 }} />
        </Box>
        <TextField
          size="small"
          label="Response body"
          fullWidth
          multiline
          minRows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          sx={{ mb: 1 }}
        />
        <Button size="small" startIcon={<AddIcon />} onClick={() => void addRoute()}>
          Add route
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
