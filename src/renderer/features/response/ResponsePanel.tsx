import {
  Box,
  Tabs,
  Tab,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  TextField,
  Button,
  Divider,
  Alert,
  IconButton,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import SearchIcon from '@mui/icons-material/Search'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import WrapTextIcon from '@mui/icons-material/WrapText'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from '@mui/material/styles'
import Editor from '@monaco-editor/react'
import type { HttpResponse, KeyValue } from '@shared/types'
import { useAppStore } from '../../stores/appStore'
import JsonPathHelpDialog from './JsonPathHelpDialog'
import {
  detectResponseBody,
  formatQueryResult,
  runJsonPathQuery
} from '../../utils/jsonQuery'
import {
  defaultResponseDownloadName,
  formatFullResponseText,
  serializeFullResponse
} from '../../utils/formatResponse'

const ResponseBodyView = memo(function ResponseBodyView({
  body,
  contentType,
  responseKey
}: {
  body: string
  contentType: string
  responseKey: string
}) {
  const theme = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(280)
  const [wordWrap, setWordWrap] = useState(true)
  const [copied, setCopied] = useState(false)

  const view = useMemo(() => detectResponseBody(body, contentType), [body, contentType])

  useEffect(() => {
    setCopied(false)
  }, [responseKey])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver(([entry]) => {
      setHeight(Math.max(160, Math.floor(entry.contentRect.height)))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [responseKey])

  const copyBody = useCallback(async () => {
    await window.fluxAPI.clipboard.writeText(view.formatted)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }, [view.formatted])

  if (!body) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Empty response body
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 0.75,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'action.hover',
          flexShrink: 0
        }}
      >
        <Chip label={view.label} size="small" color={view.language === 'json' ? 'primary' : 'default'} />
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          {body.length.toLocaleString()} characters
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={wordWrap ? 'wrap' : 'nowrap'}
          onChange={(_, value) => value && setWordWrap(value === 'wrap')}
        >
          <ToggleButton value="wrap" aria-label="Wrap lines">
            <WrapTextIcon sx={{ fontSize: 18 }} />
          </ToggleButton>
          <ToggleButton value="nowrap" aria-label="No wrap">
            <Typography variant="caption" sx={{ px: 0.5, fontWeight: 600 }}>
              &gt;&gt;
            </Typography>
          </ToggleButton>
        </ToggleButtonGroup>
        <Tooltip title={copied ? 'Copied!' : 'Copy body'}>
          <IconButton size="small" onClick={() => void copyBody()}>
            <ContentCopyIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Box ref={containerRef} sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Editor
          key={`${responseKey}:${view.language}:${wordWrap}`}
          height={height}
          language={view.language}
          value={view.formatted}
          theme={theme.palette.mode === 'dark' ? 'vs-dark' : 'vs'}
          options={{
            readOnly: true,
            domReadOnly: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            lineHeight: 20,
            fontFamily: 'Consolas, "Cascadia Code", "Courier New", monospace',
            wordWrap: wordWrap ? 'on' : 'off',
            lineNumbers: 'on',
            folding: view.language === 'json' || view.language === 'xml' || view.language === 'html',
            renderLineHighlight: 'all',
            padding: { top: 12, bottom: 12 },
            scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            contextmenu: false
          }}
        />
      </Box>
    </Box>
  )
})

const JsonQueryPanel = memo(function JsonQueryPanel({
  data,
  responseKey
}: {
  data: unknown
  responseKey: string
}) {
  const [jsonQuery, setJsonQuery] = useState('')
  const [queryResult, setQueryResult] = useState<string | null>(null)
  const [queryError, setQueryError] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    setJsonQuery('')
    setQueryResult(null)
    setQueryError(null)
  }, [responseKey])

  const runQuery = useCallback(() => {
    if (!jsonQuery.trim()) return
    const outcome = runJsonPathQuery(data, jsonQuery)
    if (!outcome.ok) {
      setQueryError(outcome.error)
      setQueryResult(null)
      return
    }
    setQueryError(null)
    setQueryResult(formatQueryResult(outcome.result))
  }, [data, jsonQuery])

  const useExample = useCallback((query: string) => {
    setJsonQuery(query)
    setQueryError(null)
    setQueryResult(null)
  }, [])

  return (
    <Box sx={{ p: 1, flexShrink: 0, bgcolor: 'action.hover' }}>
      <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
          JSONPath
        </Typography>
        <Tooltip title="JSONPath help">
          <IconButton size="small" onClick={() => setHelpOpen(true)} aria-label="JSONPath help">
            <HelpOutlineIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <TextField
          size="small"
          fullWidth
          placeholder="$.data.items[0].name"
          value={jsonQuery}
          onChange={(e) => setJsonQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') runQuery()
          }}
          sx={{ bgcolor: 'background.paper' }}
          slotProps={{
            input: { sx: { fontFamily: 'Consolas, monospace', fontSize: 13 } }
          }}
        />
        <Button
          size="small"
          variant="contained"
          startIcon={<SearchIcon />}
          onClick={runQuery}
          disabled={!jsonQuery.trim()}
        >
          Query
        </Button>
      </Box>
      {queryError && (
        <Alert severity="error" sx={{ py: 0 }}>
          {queryError}
        </Alert>
      )}
      {queryResult !== null && !queryError && (
        <Box sx={{ maxHeight: 160, overflow: 'auto', mt: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Query result
          </Typography>
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 1.5,
              fontSize: 12,
              fontFamily: 'Consolas, "Cascadia Code", "Courier New", monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              bgcolor: 'background.paper',
              borderRadius: 1,
              border: 1,
              borderColor: 'divider'
            }}
          >
            {queryResult}
          </Box>
        </Box>
      )}
      <JsonPathHelpDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        onUseExample={useExample}
      />
    </Box>
  )
})

function KeyValueList({ items, emptyText }: { items: KeyValue[]; emptyText: string }) {
  if (items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
        {emptyText}
      </Typography>
    )
  }

  return (
    <List dense disablePadding>
      {items.map((item) => (
        <ListItem
          key={item.id}
          sx={{
            py: 0.75,
            borderBottom: 1,
            borderColor: 'divider',
            alignItems: 'flex-start'
          }}
        >
          <ListItemText
            primary={item.key}
            secondary={item.value}
            primaryTypographyProps={{
              variant: 'caption',
              fontWeight: 700,
              fontFamily: 'Consolas, monospace',
              color: 'primary.main'
            }}
            secondaryTypographyProps={{
              variant: 'body2',
              sx: { wordBreak: 'break-all', mt: 0.25 }
            }}
          />
        </ListItem>
      ))}
    </List>
  )
}

function ResponseActions({ response }: { response: HttpResponse }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setCopied(false)
  }, [response.statusCode, response.body.length])

  const copyFullResponse = useCallback(async () => {
    await window.fluxAPI.clipboard.writeText(formatFullResponseText(response))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }, [response])

  const downloadFullResponse = useCallback(async () => {
    const filePath = await window.fluxAPI.dialog.saveFile(defaultResponseDownloadName(response), [
      { name: 'JSON', extensions: ['json'] },
      { name: 'Text', extensions: ['txt'] }
    ])
    if (!filePath) return

    const content = filePath.toLowerCase().endsWith('.txt')
      ? formatFullResponseText(response)
      : serializeFullResponse(response)

    await window.fluxAPI.fs.writeTextFile(filePath, content)
  }, [response])

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
      <Tooltip title={copied ? 'Copied!' : 'Copy full response'}>
        <IconButton size="small" onClick={() => void copyFullResponse()} aria-label="Copy full response">
          <ContentCopyIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Download response">
        <IconButton size="small" onClick={() => void downloadFullResponse()} aria-label="Download response">
          <FileDownloadIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
    </Box>
  )
}

export default memo(function ResponsePanel() {
  const response = useAppStore((s) => s.response)
  const testResults = useAppStore((s) => s.testResults)
  const [tab, setTab] = useState(0)

  const contentType = useMemo(() => {
    if (!response?.headers) return ''
    const entry = Object.entries(response.headers).find(([k]) => k.toLowerCase() === 'content-type')
    return entry?.[1] ?? ''
  }, [response?.headers])

  const bodyView = useMemo(
    () => (response?.body ? detectResponseBody(response.body, contentType) : null),
    [response?.body, contentType]
  )

  const responseKey = response ? `${response.statusCode}:${response.body.length}` : ''

  if (!response) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography color="text.secondary">Send a request to see the response</Typography>
      </Box>
    )
  }

  const statusColor =
    response.statusCode >= 200 && response.statusCode < 300
      ? 'success'
      : response.statusCode >= 400
        ? 'error'
        : 'warning'

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        <Chip label={`${response.statusCode} ${response.statusText}`} color={statusColor} size="small" />
        <Typography variant="caption">{response.durationMs} ms</Typography>
        <Typography variant="caption">{response.sizeBytes.toLocaleString()} B</Typography>
        <Box sx={{ flex: 1 }} />
        {bodyView && tab === 0 && (
          <Chip label={bodyView.label} size="small" variant="outlined" />
        )}
        <ResponseActions response={response} />
      </Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 36, px: 1 }}>
        <Tab label="Body" sx={{ minHeight: 36 }} />
        <Tab label="Headers" sx={{ minHeight: 36 }} />
        <Tab label="Cookies" sx={{ minHeight: 36 }} />
        {testResults.length > 0 && (
          <Tab label={`Tests (${testResults.filter((t) => t.passed).length}/${testResults.length})`} sx={{ minHeight: 36 }} />
        )}
      </Tabs>

      {tab === 0 && (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              m: 1,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              overflow: 'hidden',
              bgcolor: 'background.paper'
            }}
          >
            <ResponseBodyView
              body={response.body}
              contentType={contentType}
              responseKey={responseKey}
            />
          </Box>

          <Divider />

          {bodyView?.data != null ? (
            <JsonQueryPanel data={bodyView.data} responseKey={responseKey} />
          ) : (
            <Box sx={{ p: 1, flexShrink: 0, bgcolor: 'action.hover' }}>
              <Typography variant="caption" color="text.secondary">
                JSON query is available when the response body is valid JSON
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {tab !== 0 && (
        <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
          {tab === 1 && (
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
              <KeyValueList
                items={Object.entries(response.headers).map(([key, value], i) => ({
                  id: String(i),
                  key,
                  value,
                  enabled: true
                }))}
                emptyText="No headers"
              />
            </Box>
          )}
          {tab === 2 && (
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
              <KeyValueList
                items={response.cookies}
                emptyText="No cookies set in this response"
              />
              {response.cookies.length > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', p: 1.5, pt: 0 }}>
                  Stored and sent on later requests to the same domain
                </Typography>
              )}
            </Box>
          )}
          {tab === 3 && testResults.length > 0 && (
            <List dense>
              {testResults.map((t, i) => (
                <ListItem key={i}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    {t.passed ? (
                      <CheckCircleIcon color="success" fontSize="small" />
                    ) : (
                      <CancelIcon color="error" fontSize="small" />
                    )}
                  </ListItemIcon>
                  <ListItemText primary={t.name} secondary={t.error} />
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      )}
    </Box>
  )
})
