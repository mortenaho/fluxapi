import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  LinearProgress,
  FormControlLabel,
  Checkbox,
  TextField
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import { useState } from 'react'
import type { CollectionModel, CollectionRunReport, CollectionRunResult } from '@shared/types'
import { useAppStore } from '../../stores/appStore'

interface Props {
  open: boolean
  collection: CollectionModel | null
  onClose: () => void
}

export default function CollectionRunnerDialog({ open, collection, onClose }: Props) {
  const settings = useAppStore((s) => s.settings)
  const [running, setRunning] = useState(false)
  const [stopOnFailure, setStopOnFailure] = useState(true)
  const [iterations, setIterations] = useState(settings.runnerIterations ?? 1)
  const [delayMs, setDelayMs] = useState(settings.runnerDelayMs ?? 0)
  const [results, setResults] = useState<CollectionRunResult[]>([])
  const [report, setReport] = useState<CollectionRunReport | null>(null)
  const [dataFilePath, setDataFilePath] = useState<string | null>(null)
  const [dataFileFormat, setDataFileFormat] = useState<'csv' | 'json'>('csv')

  const run = async () => {
    if (!collection) return
    setRunning(true)
    setResults([])
    setReport(null)
    const startedAt = Date.now()
    try {
      const outcome = await window.lisek.runner.runCollection(collection.id, {
        stopOnFailure,
        iterations,
        delayMs,
        dataFilePath: dataFilePath || undefined,
        dataFileFormat: dataFilePath ? dataFileFormat : undefined
      })
      setResults(outcome)
      setReport({
        collectionId: collection.id,
        collectionName: collection.name,
        startedAt,
        finishedAt: Date.now(),
        iterations,
        delayMs,
        results: outcome,
        passed: outcome.filter((r) => r.passed).length,
        failed: outcome.filter((r) => !r.passed).length
      })
    } finally {
      setRunning(false)
    }
  }

  const exportReport = async (format: 'json' | 'html') => {
    if (!report) return
    const ext = format === 'json' ? 'json' : 'html'
    const path = await window.lisek.dialog.saveFile(`${collection?.name || 'report'}.${ext}`, [
      { name: format.toUpperCase(), extensions: [ext] }
    ])
    if (!path) return
    await window.lisek.runner.exportReport(report, path, format)
  }

  const passed = results.filter((r) => r.passed).length

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" fontWeight={600}>
          Run Collection — {collection?.name}
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <TextField
            label="Iterations"
            type="number"
            size="small"
            value={iterations}
            onChange={(e) => setIterations(Math.max(1, parseInt(e.target.value, 10) || 1))}
            sx={{ width: 120 }}
          />
          <TextField
            label="Delay (ms)"
            type="number"
            size="small"
            value={delayMs}
            onChange={(e) => setDelayMs(Math.max(0, parseInt(e.target.value, 10) || 0))}
            sx={{ width: 120 }}
          />
        </Box>
        <FormControlLabel
          control={
            <Checkbox checked={stopOnFailure} onChange={(e) => setStopOnFailure(e.target.checked)} />
          }
          label="Stop on first failure"
          sx={{ mb: 1 }}
        />
        <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            size="small"
            variant="outlined"
            onClick={async () => {
              const path = await window.lisek.dialog.openFile([
                { name: 'Data', extensions: ['csv', 'json'] }
              ])
              if (!path) return
              setDataFilePath(path)
              setDataFileFormat(path.toLowerCase().endsWith('.json') ? 'json' : 'csv')
            }}
          >
            {dataFilePath ? 'Change data file' : 'Load CSV/JSON data'}
          </Button>
          {dataFilePath && (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                {dataFilePath.split(/[/\\]/).pop()}
              </Typography>
              <Button size="small" onClick={() => setDataFilePath(null)}>
                Clear
              </Button>
            </>
          )}
        </Box>
        {running && <LinearProgress sx={{ mb: 2 }} />}
        {results.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            {passed}/{results.length} passed
          </Typography>
        )}
        <List dense disablePadding sx={{ maxHeight: 360, overflow: 'auto' }}>
          {results.map((result, idx) => (
            <ListItem key={`${result.requestId}-${result.iteration ?? 0}-${idx}`} sx={{ py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 32 }}>
                {result.passed ? (
                  <CheckCircleIcon color="success" fontSize="small" />
                ) : (
                  <CancelIcon color="error" fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={`${result.requestName}${result.iteration && result.iteration > 1 ? ` (#${result.iteration})` : ''}`}
                secondary={
                  result.error
                    ? `${result.statusCode || 'ERR'} · ${result.error}`
                    : `${result.statusCode} · ${result.durationMs} ms`
                }
                primaryTypographyProps={{ variant: 'body2' }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItem>
          ))}
        </List>
        {results.length === 0 && !running && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Run all HTTP/GraphQL requests in this collection sequentially
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {report && (
          <>
            <Button startIcon={<FileDownloadIcon />} onClick={() => void exportReport('json')}>
              Export JSON
            </Button>
            <Button startIcon={<FileDownloadIcon />} onClick={() => void exportReport('html')}>
              Export HTML
            </Button>
          </>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>Close</Button>
        <Button
          variant="contained"
          startIcon={<PlayArrowIcon />}
          disabled={running || !collection}
          onClick={() => void run()}
        >
          Run
        </Button>
      </DialogActions>
    </Dialog>
  )
}
