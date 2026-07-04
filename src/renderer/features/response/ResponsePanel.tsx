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
import CloseIcon from '@mui/icons-material/Close'
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { editor } from 'monaco-editor'
import { useTheme } from '@mui/material/styles'
import Editor from '@monaco-editor/react'
import type { HttpResponse, KeyValue } from '@shared/types'
import { useAppStore } from '../../stores/appStore'
import JsonPathHelpDialog from './JsonPathHelpDialog'
import {
  detectResponseBody,
  formatQueryResult,
  isHtmlResponse,
  runJsonPathQuery
} from '../../utils/jsonQuery'
import {
  defaultResponseDownloadName,
  formatFullResponseText,
  serializeFullResponse
} from '../../utils/formatResponse'

export type ResponseBodyViewHandle = {
  openFind: () => void
}

const ResponseBodyView = memo(
  forwardRef<
    ResponseBodyViewHandle,
    { body: string; contentType: string; responseKey: string }
  >(function ResponseBodyView({ body, contentType, responseKey }, ref) {
  const theme = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
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

  useImperativeHandle(ref, () => ({
    openFind: () => {
      editorRef.current?.getAction('actions.find')?.run()
    }
  }), [])

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
          onMount={(editorInstance) => {
            editorRef.current = editorInstance
          }}
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
}))

type ResponseTab = 'body' | 'preview' | 'headers' | 'cookies' | 'tests' | 'console'

const TAB_LABELS: Record<ResponseTab, string> = {
  body: 'Body',
  preview: 'Preview',
  headers: 'Headers',
  cookies: 'Cookies',
  tests: 'Tests',
  console: 'Console'
}

const HtmlPreview = memo(function HtmlPreview({
  html,
  responseKey
}: {
  html: string
  responseKey: string
}) {
  return (
    <Box sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          px: 1.5,
          py: 0.75,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'action.hover',
          flexShrink: 0
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Rendered HTML preview (scripts disabled for safety)
        </Typography>
      </Box>
      <Box
        component="iframe"
        key={responseKey}
        title="HTML preview"
        sandbox=""
        srcDoc={html}
        sx={{
          flex: 1,
          width: '100%',
          minHeight: 280,
          border: 0,
          bgcolor: '#fff'
        }}
      />
    </Box>
  )
})

const JsonQueryPanel = memo(function JsonQueryPanel({
  data,
  responseKey,
  open,
  onClose,
  inputRef
}: {
  data: unknown
  responseKey: string
  open: boolean
  onClose: () => void
  inputRef: React.RefObject<HTMLInputElement | null>
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

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open, inputRef])

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

  if (!open) return null

  return (
    <Box
      sx={{
        px: 0.75,
        py: 0.25,
        flexShrink: 0,
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: 'action.hover'
      }}
    >
      <Box sx={{ display: 'flex', gap: 0.25, alignItems: 'center' }}>
        <Tooltip title="JSONPath help">
          <IconButton
            size="small"
            onClick={() => setHelpOpen(true)}
            aria-label="JSONPath help"
            sx={{ p: 0.25 }}
          >
            <HelpOutlineIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        <TextField
          size="small"
          fullWidth
          inputRef={inputRef}
          placeholder="JSONPath — e.g. $.data.items[0].name"
          value={jsonQuery}
          onChange={(e) => setJsonQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') runQuery()
            if (e.key === 'Escape') onClose()
          }}
          sx={{
            bgcolor: 'background.paper',
            '& .MuiInputBase-root': { height: 24, py: 0 },
            '& .MuiInputBase-input': { py: 0.25, px: 0.75 }
          }}
          slotProps={{
            input: { sx: { fontFamily: 'Consolas, monospace', fontSize: 11 } }
          }}
        />
        <Tooltip title="Run query">
          <span>
            <IconButton
              size="small"
              onClick={runQuery}
              disabled={!jsonQuery.trim()}
              aria-label="Run JSONPath query"
              sx={{ p: 0.25 }}
            >
              <SearchIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Close (Esc)">
          <IconButton size="small" onClick={onClose} aria-label="Close search" sx={{ p: 0.25 }}>
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>
      {queryError && (
        <Typography variant="caption" color="error" sx={{ display: 'block', px: 0.5, lineHeight: 1.3 }}>
          {queryError}
        </Typography>
      )}
      {queryResult !== null && !queryError && (
        <Box
          component="pre"
          sx={{
            m: 0,
            mt: 0.25,
            px: 0.75,
            py: 0.25,
            maxHeight: 72,
            overflow: 'auto',
            fontSize: 10,
            lineHeight: 1.35,
            fontFamily: 'Consolas, "Cascadia Code", "Courier New", monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            bgcolor: 'background.paper',
            borderRadius: 0.5,
            border: 1,
            borderColor: 'divider'
          }}
        >
          {queryResult}
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
  const scriptLogs = useAppStore((s) => s.scriptLogs)
  const [tab, setTab] = useState<ResponseTab>('body')
  const [queryPanelOpen, setQueryPanelOpen] = useState(false)
  const bodyViewRef = useRef<ResponseBodyViewHandle>(null)
  const queryInputRef = useRef<HTMLInputElement>(null)

  const contentType = useMemo(() => {
    if (!response?.headers) return ''
    const entry = Object.entries(response.headers).find(([k]) => k.toLowerCase() === 'content-type')
    return entry?.[1] ?? ''
  }, [response?.headers])

  const bodyView = useMemo(
    () => (response?.body ? detectResponseBody(response.body, contentType) : null),
    [response?.body, contentType]
  )

  const showHtmlPreview = useMemo(
    () => (response?.body ? isHtmlResponse(response.body, contentType) : false),
    [response?.body, contentType]
  )

  const responseKey = response ? `${response.statusCode}:${response.body.length}` : ''

  const tabs = useMemo(() => {
    const list: ResponseTab[] = ['body']
    if (showHtmlPreview) list.push('preview')
    list.push('headers', 'cookies')
    if (testResults.length > 0) list.push('tests')
    if (scriptLogs.length > 0) list.push('console')
    return list
  }, [showHtmlPreview, testResults.length, scriptLogs.length])

  useEffect(() => {
    setTab('body')
    setQueryPanelOpen(false)
  }, [responseKey])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && queryPanelOpen) {
        setQueryPanelOpen(false)
        return
      }

      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'f') return
      if (tab !== 'body' || !response) return

      e.preventDefault()
      if (bodyView?.data != null) {
        setQueryPanelOpen(true)
      } else {
        bodyViewRef.current?.openFind()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [tab, response, bodyView?.data, queryPanelOpen])

  useEffect(() => {
    if (!tabs.includes(tab)) setTab('body')
  }, [tab, tabs])

  const testsSummary =
    testResults.length > 0
      ? `${testResults.filter((t) => t.passed).length}/${testResults.length}`
      : ''

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
        {bodyView && tab === 'body' && (
          <Chip label={bodyView.label} size="small" variant="outlined" />
        )}
        <ResponseActions response={response} />
      </Box>
      <Tabs
        value={tab}
        onChange={(_, value: ResponseTab) => setTab(value)}
        sx={{ minHeight: 36, px: 1 }}
      >
        {tabs.map((tabId) => (
          <Tab
            key={tabId}
            value={tabId}
            label={
              tabId === 'tests'
                ? `Tests (${testsSummary})`
                : tabId === 'console'
                  ? `Console (${scriptLogs.length})`
                  : TAB_LABELS[tabId]
            }
            sx={{ minHeight: 36 }}
          />
        ))}
      </Tabs>

      {tab === 'body' && (
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
              bgcolor: 'background.paper',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <ResponseBodyView
                ref={bodyViewRef}
                body={response.body}
                contentType={contentType}
                responseKey={responseKey}
              />
            </Box>
            {bodyView?.data != null && (
              <JsonQueryPanel
                data={bodyView.data}
                responseKey={responseKey}
                open={queryPanelOpen}
                onClose={() => setQueryPanelOpen(false)}
                inputRef={queryInputRef}
              />
            )}
          </Box>
        </Box>
      )}

      {tab === 'preview' && showHtmlPreview && (
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
          <HtmlPreview html={response.body} responseKey={responseKey} />
        </Box>
      )}

      {tab !== 'body' && tab !== 'preview' && (
        <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
          {tab === 'headers' && (
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
          {tab === 'cookies' && (
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
          {tab === 'tests' && testResults.length > 0 && (
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
          {tab === 'console' && scriptLogs.length > 0 && (
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 1.5,
                fontFamily: 'Consolas, monospace',
                fontSize: 13,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {scriptLogs.join('\n')}
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
})
