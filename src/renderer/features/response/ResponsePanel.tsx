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
  ToggleButtonGroup,
  Button
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import SearchIcon from '@mui/icons-material/Search'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import WrapTextIcon from '@mui/icons-material/WrapText'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import CloseIcon from '@mui/icons-material/Close'
import BoltIcon from '@mui/icons-material/Bolt'
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
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
import { diffText, prettyJson } from '../../utils/responseDiff'
import { COMPACT, formatBytes } from '../../theme/compact'
import { applyControlledInputChange } from '../../utils/inputSelection'

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
      setHeight(Math.max(120, Math.floor(entry.contentRect.height)))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [responseKey])

  const copyBody = useCallback(async () => {
    await window.lisek.clipboard.writeText(view.formatted)
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
      <Box sx={{ p: 1.5, textAlign: 'center' }}>
        <Typography sx={{ ...COMPACT.caption }}>Empty response body</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 0.75,
          py: 0.25,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'action.hover',
          flexShrink: 0,
          minHeight: 24
        }}
      >
        <Chip
          label={view.label}
          size="small"
          color={view.language === 'json' ? 'primary' : 'default'}
          sx={COMPACT.chip}
        />
        <Typography sx={{ ...COMPACT.caption, flex: 1 }}>
          {body.length.toLocaleString()} chars
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={wordWrap ? 'wrap' : 'nowrap'}
          onChange={(_, value) => value && setWordWrap(value === 'wrap')}
          sx={{ '& .MuiToggleButton-root': { py: 0.125, px: 0.5 } }}
        >
          <ToggleButton value="wrap" aria-label="Wrap lines">
            <WrapTextIcon sx={COMPACT.icon} />
          </ToggleButton>
          <ToggleButton value="nowrap" aria-label="No wrap">
            <Typography sx={{ px: 0.25, fontSize: 10, fontWeight: 700, lineHeight: 1 }}>
              &gt;&gt;
            </Typography>
          </ToggleButton>
        </ToggleButtonGroup>
        <Tooltip title={copied ? 'Copied!' : 'Copy body'}>
          <IconButton size="small" onClick={() => void copyBody()} sx={COMPACT.iconBtn}>
            <ContentCopyIcon sx={COMPACT.icon} />
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
            fontSize: 11,
            lineHeight: 16,
            fontFamily: 'Consolas, "Cascadia Code", "Courier New", monospace',
            wordWrap: wordWrap ? 'on' : 'off',
            lineNumbers: 'on',
            lineNumbersMinChars: 3,
            folding: view.language === 'json' || view.language === 'xml' || view.language === 'html',
            renderLineHighlight: 'line',
            padding: { top: 4, bottom: 4 },
            scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            contextmenu: false
          }}
        />
      </Box>
    </Box>
  )
}))

type ResponseTab = 'body' | 'preview' | 'headers' | 'cookies' | 'tests' | 'console' | 'diff'

const TAB_LABELS: Record<ResponseTab, string> = {
  body: 'Body',
  preview: 'Preview',
  headers: 'Headers',
  cookies: 'Cookies',
  tests: 'Tests',
  console: 'Console',
  diff: 'Diff'
}

const HtmlPreview = memo(function HtmlPreview({
  html,
  responseKey
}: {
  html: string
  responseKey: string
}) {
  return (
    <Box sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', p: 0.5 }}>
      <Box
        component="iframe"
        key={responseKey}
        title="HTML preview"
        sandbox=""
        srcDoc={html}
        sx={{
          flex: 1,
          width: '100%',
          minHeight: 120,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
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
  const [envVarName, setEnvVarName] = useState('')
  const environments = useAppStore((s) => s.environments)
  const loadEnvironments = useAppStore((s) => s.loadEnvironments)

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

  const setEnvFromQuery = useCallback(async () => {
    if (!jsonQuery.trim()) return
    const outcome = runJsonPathQuery(data, jsonQuery)
    if (!outcome.ok) {
      setQueryError(outcome.error)
      return
    }
    const name = envVarName.trim()
    if (!name) {
      setQueryError('Enter an environment variable name')
      return
    }
    const activeEnv = environments.find((e) => e.isActive)
    if (!activeEnv) {
      setQueryError('No active environment')
      return
    }
    const value =
      typeof outcome.result === 'object' ? JSON.stringify(outcome.result) : String(outcome.result ?? '')
    const vars = activeEnv.variables.map((v) => ({ ...v }))
    const idx = vars.findIndex((v) => v.key === name)
    if (idx >= 0) vars[idx] = { ...vars[idx], value, enabled: true }
    else vars.push({ id: uuidv4(), key: name, value, enabled: true })
    await window.lisek.environments.save({ ...activeEnv, variables: vars })
    await loadEnvironments()
    setQueryError(null)
    setQueryResult(`Set {{${name}}} = ${value}`)
  }, [data, jsonQuery, envVarName, environments, loadEnvironments])

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
          onChange={(e) =>
            applyControlledInputChange(e.target, jsonQuery, e.target.value, setJsonQuery)
          }
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
        <TextField
          size="small"
          placeholder="env var"
          value={envVarName}
          onChange={(e) => setEnvVarName(e.target.value)}
          sx={{ width: 88, '& .MuiInputBase-root': { height: 24 }, '& .MuiInputBase-input': { py: 0.25, px: 0.5, fontSize: 11 } }}
        />
        <Tooltip title="Set active environment variable from JSONPath result">
          <span>
            <IconButton
              size="small"
              onClick={() => void setEnvFromQuery()}
              disabled={!jsonQuery.trim() || !envVarName.trim()}
              aria-label="Set environment variable"
              sx={{ p: 0.25 }}
            >
              <BoltIcon sx={{ fontSize: 14 }} />
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
      <Typography sx={{ ...COMPACT.caption, p: 1 }}>
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
            py: 0.375,
            px: 1,
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
              fontSize: 10,
              fontFamily: 'Consolas, monospace',
              color: 'primary.main',
              lineHeight: 1.3
            }}
            secondaryTypographyProps={{
              variant: 'caption',
              fontSize: 11,
              sx: { wordBreak: 'break-all', mt: 0.125, lineHeight: 1.35 }
            }}
          />
        </ListItem>
      ))}
    </List>
  )
}

const EXAMPLE_REQUESTS = [
  { label: 'GET JSONPlaceholder', url: 'https://jsonplaceholder.typicode.com/posts/1', method: 'GET' as const },
  { label: 'GET GitHub API', url: 'https://api.github.com/repos/electron/electron', method: 'GET' as const },
  { label: 'GET HTTPBin', url: 'https://httpbin.org/get', method: 'GET' as const }
]

function ResponseEmptyState() {
  const tryExample = useCallback(
    async (url: string, method: 'GET') => {
      const state = useAppStore.getState()
      if (!state.activeRequest) {
        await state.createRequest()
      }
      state.updateActiveRequest({ url, method, protocol: 'http' })
      await state.sendRequest()
    },
    []
  )

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        py: 4,
        textAlign: 'center'
      }}
    >
      <BoltIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1.5, opacity: 0.9 }} />
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2, maxWidth: 280, lineHeight: 1.5 }}>
        No response yet. Enter a URL and press Send — or try an example:
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, width: '100%', maxWidth: 260 }}>
        {EXAMPLE_REQUESTS.map((ex) => (
          <Button
            key={ex.url}
            size="small"
            variant="outlined"
            onClick={() => void tryExample(ex.url, ex.method)}
            sx={{
              justifyContent: 'flex-start',
              textTransform: 'none',
              fontSize: 11,
              py: 0.75,
              borderColor: 'divider',
              color: 'text.secondary',
              '&:hover': {
                borderColor: 'primary.main',
                color: 'primary.main',
                bgcolor: 'action.hover'
              }
            }}
          >
            {ex.label}
          </Button>
        ))}
      </Box>
    </Box>
  )
}

function ResponseActions({
  response,
  onSaveSnapshot
}: {
  response: HttpResponse
  onSaveSnapshot: () => void
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setCopied(false)
  }, [response.statusCode, response.body.length])

  const copyFullResponse = useCallback(async () => {
    await window.lisek.clipboard.writeText(formatFullResponseText(response))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }, [response])

  const downloadFullResponse = useCallback(async () => {
    const filePath = await window.lisek.dialog.saveFile(defaultResponseDownloadName(response), [
      { name: 'JSON', extensions: ['json'] },
      { name: 'Text', extensions: ['txt'] }
    ])
    if (!filePath) return

    const content = filePath.toLowerCase().endsWith('.txt')
      ? formatFullResponseText(response)
      : serializeFullResponse(response)

    await window.lisek.fs.writeTextFile(filePath, content)
  }, [response])

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.125 }}>
      <Tooltip title="Save body snapshot for diff">
        <IconButton size="small" onClick={onSaveSnapshot} aria-label="Save snapshot" sx={COMPACT.iconBtn}>
          <BoltIcon sx={COMPACT.icon} />
        </IconButton>
      </Tooltip>
      <Tooltip title={copied ? 'Copied!' : 'Copy full response'}>
        <IconButton
          size="small"
          onClick={() => void copyFullResponse()}
          aria-label="Copy full response"
          sx={COMPACT.iconBtn}
        >
          <ContentCopyIcon sx={COMPACT.icon} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Download response">
        <IconButton
          size="small"
          onClick={() => void downloadFullResponse()}
          aria-label="Download response"
          sx={COMPACT.iconBtn}
        >
          <FileDownloadIcon sx={COMPACT.icon} />
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
  const [snapshotBody, setSnapshotBody] = useState<string | null>(null)
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
    if (snapshotBody && response?.body) list.push('diff')
    return list
  }, [showHtmlPreview, testResults.length, scriptLogs.length, snapshotBody, response?.body])

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
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box
          sx={{
            px: 1.5,
            py: 1,
            borderBottom: 1,
            borderColor: 'divider',
            flexShrink: 0
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13 }}>
            Response
          </Typography>
        </Box>
        <ResponseEmptyState />
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
          gap: 0.75,
          borderBottom: 1,
          borderColor: 'divider',
          ...COMPACT.bar
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13, mr: 0.5, flexShrink: 0 }}>
          Response
        </Typography>
        <Tooltip title={`${response.statusCode} ${response.statusText}`}>
          <Chip
            label={response.statusCode}
            color={statusColor}
            size="small"
            sx={COMPACT.chip}
          />
        </Tooltip>
        <Typography sx={COMPACT.caption}>
          {response.durationMs}ms · {formatBytes(response.sizeBytes)}
        </Typography>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Tabs
            value={tab}
            onChange={(_, value: ResponseTab) => setTab(value)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 28,
              '& .MuiTabs-indicator': { height: 2 },
              '& .MuiTabs-flexContainer': { gap: 0.25 }
            }}
          >
            {tabs.map((tabId) => (
              <Tab
                key={tabId}
                value={tabId}
                label={
                  tabId === 'tests'
                    ? `Tests ${testsSummary}`
                    : tabId === 'console'
                      ? `Console ${scriptLogs.length}`
                      : TAB_LABELS[tabId]
                }
                sx={COMPACT.tabRoot}
              />
            ))}
          </Tabs>
        </Box>
        <ResponseActions
          response={response}
          onSaveSnapshot={() => setSnapshotBody(prettyJson(response.body))}
        />
      </Box>

      {tab === 'body' && (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              border: 1,
              borderColor: 'divider',
              overflow: 'hidden',
              bgcolor: 'background.paper',
              display: 'flex',
              flexDirection: 'column',
              ...COMPACT.panel
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
            border: 1,
            borderColor: 'divider',
            overflow: 'hidden',
            bgcolor: 'background.paper',
            ...COMPACT.panel
          }}
        >
          <HtmlPreview html={response.body} responseKey={responseKey} />
        </Box>
      )}

      {tab !== 'body' && tab !== 'preview' && (
        <Box sx={{ flex: 1, overflow: 'auto', ...COMPACT.panel }}>
          {tab === 'headers' && (
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 0.75, overflow: 'hidden' }}>
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
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 0.75, overflow: 'hidden' }}>
              <KeyValueList
                items={response.cookies}
                emptyText="No cookies set in this response"
              />
              {response.cookies.length > 0 && (
                <Typography sx={{ ...COMPACT.caption, display: 'block', px: 1, pb: 0.75 }}>
                  Stored and sent on later requests to the same domain
                </Typography>
              )}
            </Box>
          )}
          {tab === 'tests' && testResults.length > 0 && (
            <List dense disablePadding>
              {testResults.map((t, i) => (
                <ListItem key={i} sx={{ py: 0.375, px: 1 }}>
                  <ListItemIcon sx={{ minWidth: 24 }}>
                    {t.passed ? (
                      <CheckCircleIcon color="success" sx={{ fontSize: 14 }} />
                    ) : (
                      <CancelIcon color="error" sx={{ fontSize: 14 }} />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={t.name}
                    secondary={t.error}
                    primaryTypographyProps={{ variant: 'caption', fontSize: 11, lineHeight: 1.3 }}
                    secondaryTypographyProps={{ variant: 'caption', fontSize: 10, lineHeight: 1.3 }}
                  />
                </ListItem>
              ))}
            </List>
          )}
          {tab === 'console' && scriptLogs.length > 0 && (
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 0.75,
                fontFamily: 'Consolas, monospace',
                fontSize: 11,
                lineHeight: 1.35,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {scriptLogs.join('\n')}
            </Box>
          )}
          {tab === 'diff' && snapshotBody && response?.body && (
            <Box sx={{ p: 0.75 }}>
              {diffText(snapshotBody, prettyJson(response.body)).map((line, i) => (
                <Typography
                  key={`${line.type}-${i}`}
                  variant="caption"
                  component="div"
                  sx={{
                    fontFamily: 'Consolas, monospace',
                    fontSize: 11,
                    whiteSpace: 'pre-wrap',
                    color:
                      line.type === 'add'
                        ? 'success.main'
                        : line.type === 'remove'
                          ? 'error.main'
                          : 'text.primary',
                    bgcolor: line.type === 'add' ? 'success.light' : line.type === 'remove' ? 'error.light' : 'transparent',
                    opacity: line.type === 'same' ? 0.8 : 1
                  }}
                >
                  {line.type === 'add' ? '+ ' : line.type === 'remove' ? '- ' : '  '}
                  {line.text}
                </Typography>
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
})
