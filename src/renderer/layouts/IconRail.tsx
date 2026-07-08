import { Box, Badge, Divider, IconButton, Tooltip } from '@mui/material'
import FolderIcon from '@mui/icons-material/Folder'
import HistoryIcon from '@mui/icons-material/History'
import DescriptionIcon from '@mui/icons-material/Description'
import ApiIcon from '@mui/icons-material/Api'
import ExtensionIcon from '@mui/icons-material/Extension'
import ImportExportIcon from '@mui/icons-material/ImportExport'
import CodeIcon from '@mui/icons-material/Code'
import CookiesIcon from '@mui/icons-material/Cookie'
import DnsIcon from '@mui/icons-material/Dns'
import type { SidebarPanel } from './SidebarMenu'

const NAV_ITEMS: { id: SidebarPanel; label: string; icon: typeof FolderIcon }[] = [
  { id: 'collections', label: 'Collections', icon: FolderIcon },
  { id: 'history', label: 'History', icon: HistoryIcon },
  { id: 'openapi', label: 'OpenAPI', icon: DescriptionIcon },
  { id: 'proto', label: 'Proto Files', icon: ApiIcon },
  { id: 'plugins', label: 'Plugins', icon: ExtensionIcon }
]

interface Props {
  activePanel: SidebarPanel
  onSelectPanel: (panel: SidebarPanel) => void
  onImport: () => void
  onSnippet: () => void
  onCookies: () => void
  onMock: () => void
  mockRunning?: boolean
  mockPort?: number
}

function RailButton({
  active,
  label,
  icon: Icon,
  onClick,
  live
}: {
  active: boolean
  label: string
  icon: typeof FolderIcon
  onClick: () => void
  live?: boolean
}) {
  return (
    <Tooltip title={label} placement="right">
      <IconButton
        size="small"
        onClick={onClick}
        aria-label={label}
        sx={{
          width: 40,
          height: 40,
          borderRadius: 1.5,
          color: active ? 'primary.main' : 'text.secondary',
          bgcolor: active ? 'action.selected' : 'transparent',
          '&:hover': {
            bgcolor: active ? 'action.selected' : 'action.hover',
            color: active ? 'primary.main' : 'text.primary'
          }
        }}
      >
        <Badge
          overlap="circular"
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          badgeContent={
            live ? (
              <Box
                sx={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  bgcolor: 'success.main',
                  border: '2px solid',
                  borderColor: 'background.paper',
                  animation: 'mockRailPulse 1.2s ease-in-out infinite',
                  '@keyframes mockRailPulse': {
                    '0%, 100%': { opacity: 1, boxShadow: '0 0 0 0 rgba(46, 125, 50, 0.45)' },
                    '50%': { opacity: 0.45, boxShadow: '0 0 0 4px rgba(46, 125, 50, 0)' }
                  }
                }}
              />
            ) : null
          }
          sx={{
            '& .MuiBadge-badge': {
              minWidth: 9,
              height: 9,
              p: 0,
              transform: 'scale(1) translate(25%, 25%)'
            }
          }}
        >
          <Icon sx={{ fontSize: 20 }} />
        </Badge>
      </IconButton>
    </Tooltip>
  )
}

export default function IconRail({
  activePanel,
  onSelectPanel,
  onImport,
  onSnippet,
  onCookies,
  onMock,
  mockRunning = false,
  mockPort = 0
}: Props) {
  const mockLabel = mockRunning
    ? `Mock Server · Running on :${mockPort || 4010}`
    : 'Mock Server'

  return (
    <Box
      sx={{
        width: 52,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 1,
        gap: 0.5,
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider'
      }}
    >
      {NAV_ITEMS.map(({ id, label, icon }) => (
        <RailButton
          key={id}
          active={activePanel === id}
          label={label}
          icon={icon}
          onClick={() => onSelectPanel(id)}
        />
      ))}

      <Box sx={{ flex: 1 }} />

      <Divider flexItem sx={{ width: 28, my: 0.5 }} />

      <RailButton active={false} label="Import" icon={ImportExportIcon} onClick={onImport} />
      <RailButton active={false} label="cURL Snippet" icon={CodeIcon} onClick={onSnippet} />
      <RailButton active={false} label="Cookie Jar" icon={CookiesIcon} onClick={onCookies} />
      <RailButton active={false} label={mockLabel} icon={DnsIcon} onClick={onMock} live={mockRunning} />
    </Box>
  )
}
