import { ThemeProvider, CssBaseline, GlobalStyles } from '@mui/material'
import { useEffect, useMemo } from 'react'
import MainLayout from './layouts/MainLayout'
import { useAppStore } from './stores/appStore'
import { createAppTheme } from './theme/appTheme'
import { APP_TOOLTIP_Z_INDEX } from './theme/zIndex'

function App() {
  const themeMode = useAppStore((s) => s.themeMode)
  const loadInitial = useAppStore((s) => s.loadInitial)

  useEffect(() => {
    loadInitial()
  }, [loadInitial])

  useEffect(() => {
    window.__lisekStore = useAppStore
  }, [])

  const theme = useMemo(() => createAppTheme(themeMode), [themeMode])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles
        styles={{
          '.flux-resizing, .flux-resizing *': {
            cursor: 'inherit !important',
            userSelect: 'none !important'
          },
          '.flux-resizing [data-resize-panel]': {
            pointerEvents: 'none'
          },
          '.MuiTooltip-popper': {
            zIndex: `${APP_TOOLTIP_Z_INDEX} !important`
          }
        }}
      />
      <MainLayout />
    </ThemeProvider>
  )
}

export default App
