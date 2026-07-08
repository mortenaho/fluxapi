import { Box, Typography } from '@mui/material'
import type { SidebarPanel } from '../layouts/SidebarMenu'

const TITLES: Record<SidebarPanel, string> = {
  collections: 'Collections',
  history: 'History',
  openapi: 'Swagger / OpenAPI',
  proto: 'Proto Files',
  plugins: 'Plugins'
}

export default function SidebarPanelHeader({
  panel,
  actions
}: {
  panel: SidebarPanel
  actions?: React.ReactNode
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 1.5,
        py: 1,
        flexShrink: 0,
        borderBottom: 1,
        borderColor: 'divider'
      }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.02em' }}>
        {TITLES[panel]}
      </Typography>
      {actions && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>{actions}</Box>
      )}
    </Box>
  )
}
