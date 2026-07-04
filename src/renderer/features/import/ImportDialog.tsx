import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useState } from 'react'
import { useAppStore } from '../../stores/appStore'

type ImportFormat = 'postman' | 'openapi' | 'insomnia'

const FORMAT_META: Record<
  ImportFormat,
  { title: string; subtitle: string; placeholder: string; extensions: string[] }
> = {
  postman: {
    title: 'Postman Collection',
    subtitle: 'Import Postman Collection v2.1 (.json)',
    placeholder: 'https://example.com/collection.json',
    extensions: ['json']
  },
  openapi: {
    title: 'OpenAPI / Swagger',
    subtitle: 'Import .json, .yaml, or .yml spec',
    placeholder: 'https://petstore.swagger.io/v2/swagger.json',
    extensions: ['json', 'yaml', 'yml']
  },
  insomnia: {
    title: 'Insomnia',
    subtitle: 'Import Insomnia export (.json)',
    placeholder: 'https://example.com/insomnia-export.json',
    extensions: ['json']
  }
}

export default function ImportDialog() {
  const open = useAppStore((s) => s.importDialogOpen)
  const importType = useAppStore((s) => s.importType)
  const setImportDialog = useAppStore((s) => s.setImportDialog)
  const curlPaste = useAppStore((s) => s.curlPaste)
  const setCurlPaste = useAppStore((s) => s.setCurlPaste)
  const loadCollections = useAppStore((s) => s.loadCollections)
  const loadRequests = useAppStore((s) => s.loadRequests)
  const loadOpenApiSpecs = useAppStore((s) => s.loadOpenApiSpecs)
  const selectRequest = useAppStore((s) => s.selectRequest)

  const [importUrl, setImportUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = () => {
    setImportDialog(false)
    setImportUrl('')
    setError(null)
    setLoading(false)
  }

  const handleBack = () => {
    setImportDialog(true, null)
    setImportUrl('')
    setError(null)
    setLoading(false)
  }

  const refreshAfterCollectionImport = async (format: ImportFormat) => {
    await loadCollections()
    await loadRequests()
    if (format === 'openapi') await loadOpenApiSpecs()
    handleClose()
  }

  const importFromFile = async (format: ImportFormat) => {
    setError(null)
    const meta = FORMAT_META[format]
    const path = await window.fluxAPI.dialog.openFile([
      { name: meta.title, extensions: meta.extensions }
    ])
    if (!path) return

    setLoading(true)
    try {
      if (format === 'postman') await window.fluxAPI.import.postman(path)
      else if (format === 'openapi') await window.fluxAPI.import.openapi(path)
      else await window.fluxAPI.import.insomnia(path)
      await refreshAfterCollectionImport(format)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  const importFromUrl = async (format: ImportFormat) => {
    const url = importUrl.trim()
    if (!url) {
      setError('Enter a URL')
      return
    }

    setError(null)
    setLoading(true)
    try {
      if (format === 'postman') await window.fluxAPI.import.postmanFromUrl(url)
      else if (format === 'openapi') await window.fluxAPI.import.openapiFromUrl(url)
      else await window.fluxAPI.import.insomniaFromUrl(url)
      await refreshAfterCollectionImport(format)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  const importCurl = async () => {
    if (!curlPaste.trim()) return
    setLoading(true)
    setError(null)
    try {
      const req = await window.fluxAPI.import.curl(curlPaste)
      await selectRequest(req)
      await loadRequests()
      handleClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  if (importType === 'curl') {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>Import cURL</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {error}
            </Alert>
          )}
          <TextField
            multiline
            minRows={6}
            fullWidth
            placeholder="Paste cURL command here..."
            value={curlPaste}
            onChange={(e) => setCurlPaste(e.target.value)}
            disabled={loading}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleBack} startIcon={<ArrowBackIcon />} disabled={loading}>
            Back
          </Button>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="contained" onClick={importCurl} disabled={loading || !curlPaste.trim()}>
            {loading ? 'Importing…' : 'Import'}
          </Button>
        </DialogActions>
      </Dialog>
    )
  }

  if (importType === 'postman' || importType === 'openapi' || importType === 'insomnia') {
    const meta = FORMAT_META[importType]
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{meta.title}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {meta.subtitle}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            size="small"
            label="Import from URL"
            placeholder={meta.placeholder}
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void importFromUrl(importType)
            }}
            sx={{ mb: 1.5 }}
          />

          <Button
            fullWidth
            variant="contained"
            onClick={() => void importFromUrl(importType)}
            disabled={loading || !importUrl.trim()}
            sx={{ mb: 2 }}
          >
            {loading ? <CircularProgress size={20} color="inherit" /> : 'Import from URL'}
          </Button>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Box sx={{ flex: 1, height: 1, bgcolor: 'divider' }} />
            <Typography variant="caption" color="text.secondary">
              or
            </Typography>
            <Box sx={{ flex: 1, height: 1, bgcolor: 'divider' }} />
          </Box>

          <Button
            fullWidth
            variant="outlined"
            onClick={() => void importFromFile(importType)}
            disabled={loading}
          >
            Choose file…
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleBack} startIcon={<ArrowBackIcon />} disabled={loading}>
            Back
          </Button>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Import</DialogTitle>
      <DialogContent sx={{ minWidth: 320 }}>
        <List>
          <ListItemButton onClick={() => setImportDialog(true, 'postman')}>
            <ListItemText primary="Postman" secondary="Collection v2.1 — file or URL" />
          </ListItemButton>
          <ListItemButton onClick={() => setImportDialog(true, 'openapi')}>
            <ListItemText primary="OpenAPI / Swagger" secondary=".json, .yaml — file or URL" />
          </ListItemButton>
          <ListItemButton onClick={() => setImportDialog(true, 'insomnia')}>
            <ListItemText primary="Insomnia" secondary="Export v4 — file or URL" />
          </ListItemButton>
          <ListItemButton onClick={() => setImportDialog(true, 'curl')}>
            <ListItemText primary="cURL" secondary="Paste cURL command" />
          </ListItemButton>
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
