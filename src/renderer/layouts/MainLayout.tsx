import {
  Box,
  IconButton,
  Toolbar,
  AppBar,
  Typography,
  Tooltip
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import Brightness4Icon from '@mui/icons-material/Brightness4'
import Brightness7Icon from '@mui/icons-material/Brightness7'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import CollectionsPanel from '../features/collections/CollectionsPanel'
import HistoryPanel from '../features/history/HistoryPanel'
import OpenApiPanel from '../features/import/OpenApiPanel'
import ProtoPanel from '../features/grpc/ProtoPanel'
import EnvironmentsDialog from '../features/environments/EnvironmentsDialog'
import RequestBuilder from '../features/request/RequestBuilder'
import ResponsePanel from '../features/response/ResponsePanel'
import ImportDialog from '../features/import/ImportDialog'
import CurlSnippetDialog from '../features/snippets/CurlSnippetDialog'
import SettingsDialog from '../features/settings/SettingsDialog'
import ShortcutsDialog from '../features/settings/ShortcutsDialog'
import CommandPalette from '../features/search/CommandPalette'
import MockServerDialog from '../features/settings/MockServerDialog'
import CookiesDialog from '../features/settings/CookiesDialog'
import AboutDialog from '../features/about/AboutDialog'
import ResizeHandle, { clamp, readStoredSize, storeSize } from '../components/ResizeHandle'
import SidebarPanelHeader from '../components/SidebarPanelHeader'
import IconRail from './IconRail'
import EnvironmentSelector from './EnvironmentSelector'
import { APP_LOGO } from '../utils/assets'

const SIDEBAR_MIN = 220
const SIDEBAR_MAX = 420
const SIDEBAR_DEFAULT = 280
const RESPONSE_MIN = 280
const RESPONSE_MAX = 720
const RESPONSE_DEFAULT = 400

const STORAGE_SIDEBAR = 'lisek:sidebar-width'
const STORAGE_RESPONSE = 'lisek:response-width'

const MemoRequestBuilder = memo(RequestBuilder)
const MemoResponsePanel = memo(ResponsePanel)

export default function MainLayout() {
  const activeSidebar = useAppStore((s) => s.activeSidebar)
  const setActiveSidebar = useAppStore((s) => s.setActiveSidebar)
  const themeMode = useAppStore((s) => s.setThemeMode)
  const currentTheme = useAppStore((s) => s.themeMode)
  const setImportDialog = useAppStore((s) => s.setImportDialog)
  const setSnippetOpen = useAppStore((s) => s.setSnippetOpen)
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen)
  const setShortcutsOpen = useAppStore((s) => s.setShortcutsOpen)
  const shortcutsOpen = useAppStore((s) => s.shortcutsOpen)
  const closeActiveTab = useAppStore((s) => s.closeActiveTab)
  const activeEnvName = useAppStore((s) => s.environments.find((e) => e.isActive)?.name ?? null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [envDialogOpen, setEnvDialogOpen] = useState(false)
  const [cookiesOpen, setCookiesOpen] = useState(false)
  const [mockOpen, setMockOpen] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    clamp(readStoredSize(STORAGE_SIDEBAR, SIDEBAR_DEFAULT), SIDEBAR_MIN, SIDEBAR_MAX)
  )
  const [responseWidth, setResponseWidth] = useState(() =>
    clamp(readStoredSize(STORAGE_RESPONSE, RESPONSE_DEFAULT), RESPONSE_MIN, RESPONSE_MAX)
  )

  const sidebarWrapRef = useRef<HTMLDivElement>(null)
  const responseWrapRef = useRef<HTMLDivElement>(null)
  const sidebarWidthRef = useRef(sidebarWidth)
  const responseWidthRef = useRef(responseWidth)
  sidebarWidthRef.current = sidebarWidth
  responseWidthRef.current = responseWidth

  const applySidebarWidth = useCallback((width: number) => {
    if (sidebarWrapRef.current) sidebarWrapRef.current.style.width = `${width}px`
  }, [])

  const applyResponseWidth = useCallback((width: number) => {
    if (responseWrapRef.current) responseWrapRef.current.style.width = `${width}px`
  }, [])

  const getResponseMax = useCallback(
    () => Math.min(RESPONSE_MAX, Math.floor(window.innerWidth * 0.55)),
    []
  )

  const commitSidebarWidth = useCallback((width: number) => {
    setSidebarWidth(width)
    storeSize(STORAGE_SIDEBAR, width)
  }, [])

  const commitResponseWidth = useCallback((width: number) => {
    setResponseWidth(width)
    storeSize(STORAGE_RESPONSE, width)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(true)
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w' && !typing) {
        e.preventDefault()
        closeActiveTab()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setCommandPaletteOpen, closeActiveTab])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', bgcolor: 'background.default' }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar variant="dense" sx={{ minHeight: 48, gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 0.5 }}>
            <Box
              component="img"
              src={APP_LOGO}
              alt="Lisek"
              sx={{ width: 26, height: 26, display: 'block' }}
            />
            <Typography
              variant="h6"
              sx={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.02em', color: '#ffffff' }}
            >
              Lisek
            </Typography>
          </Box>

          <EnvironmentSelector
            activeEnvName={activeEnvName}
            onOpen={() => setEnvDialogOpen(true)}
          />

          <Box sx={{ flexGrow: 1 }} />

          <Tooltip title="Toggle theme">
            <IconButton
              color="inherit"
              size="small"
              sx={{ color: 'rgba(255,255,255,0.9)', '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' } }}
              onClick={() => themeMode(currentTheme === 'light' ? 'dark' : 'light')}
            >
              {currentTheme === 'light' ? <Brightness4Icon /> : <Brightness7Icon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Settings">
            <IconButton
              color="inherit"
              size="small"
              sx={{ color: 'rgba(255,255,255,0.9)', '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' } }}
              onClick={() => setSettingsOpen(true)}
            >
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          display: 'flex',
          flex: 1,
          mt: '48px',
          minHeight: 0,
          overflow: 'hidden'
        }}
      >
        <IconRail
          activePanel={activeSidebar}
          onSelectPanel={setActiveSidebar}
          onImport={() => setImportDialog(true)}
          onSnippet={() => setSnippetOpen(true)}
          onCookies={() => setCookiesOpen(true)}
          onMock={() => setMockOpen(true)}
        />

        <Box
          ref={sidebarWrapRef}
          sx={{
            width: sidebarWidth,
            flexShrink: 0,
            height: '100%',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper',
            borderRight: 1,
            borderColor: 'divider',
            contain: 'layout style'
          }}
        >
          {activeSidebar === 'history' && <SidebarPanelHeader panel="history" />}
          {activeSidebar === 'openapi' && <SidebarPanelHeader panel="openapi" />}
          {activeSidebar === 'proto' && <SidebarPanelHeader panel="proto" />}

          <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0, px: activeSidebar === 'collections' ? 0 : 1, py: activeSidebar === 'collections' ? 0 : 1 }} data-resize-panel>
            {activeSidebar === 'collections' && <CollectionsPanel />}
            {activeSidebar === 'history' && <HistoryPanel />}
            {activeSidebar === 'openapi' && <OpenApiPanel />}
            {activeSidebar === 'proto' && <ProtoPanel />}
          </Box>
        </Box>

        <ResizeHandle
          axis="x"
          min={SIDEBAR_MIN}
          max={SIDEBAR_MAX}
          getSize={() => sidebarWidthRef.current}
          onLiveResize={applySidebarWidth}
          onCommit={commitSidebarWidth}
        />

        <Box
          component="main"
          sx={{
            flex: 1,
            display: 'flex',
            minWidth: 0,
            overflow: 'hidden',
            bgcolor: 'background.default'
          }}
        >
          <Box
            sx={{
              flex: 1,
              overflow: 'auto',
              minWidth: 0,
              minHeight: 0,
              contain: 'layout style',
              borderRight: 1,
              borderColor: 'divider'
            }}
            data-resize-panel
          >
            <MemoRequestBuilder />
          </Box>

          <ResizeHandle
            axis="x"
            min={RESPONSE_MIN}
            max={getResponseMax()}
            getSize={() => responseWidthRef.current}
            onLiveResize={applyResponseWidth}
            onCommit={commitResponseWidth}
            invert
          />

          <Box
            ref={responseWrapRef}
            data-resize-panel
            sx={{
              width: responseWidth,
              minWidth: RESPONSE_MIN,
              flexShrink: 0,
              overflow: 'hidden',
              bgcolor: 'background.paper',
              contain: 'layout style'
            }}
          >
            <MemoResponsePanel />
          </Box>
        </Box>
      </Box>

      <EnvironmentsDialog open={envDialogOpen} onClose={() => setEnvDialogOpen(false)} />
      <CookiesDialog open={cookiesOpen} onClose={() => setCookiesOpen(false)} />
      <MockServerDialog open={mockOpen} onClose={() => setMockOpen(false)} />
      <ImportDialog />
      <CurlSnippetDialog />
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onShowAbout={() => setAboutOpen(true)}
        onShowShortcuts={() => setShortcutsOpen(true)}
      />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <CommandPalette />
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </Box>
  )
}
