import { useState } from 'react'
import {
  Box,
  Button,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography
} from '@mui/material'
import FolderIcon from '@mui/icons-material/Folder'
import HistoryIcon from '@mui/icons-material/History'
import PublicIcon from '@mui/icons-material/Public'
import ApiIcon from '@mui/icons-material/Api'
import DescriptionIcon from '@mui/icons-material/Description'
import ExtensionIcon from '@mui/icons-material/Extension'
import ImportExportIcon from '@mui/icons-material/ImportExport'
import CodeIcon from '@mui/icons-material/Code'
import CookiesIcon from '@mui/icons-material/Cookie'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import CheckIcon from '@mui/icons-material/Check'

export type SidebarPanel = 'collections' | 'history' | 'openapi' | 'proto' | 'plugins'

const PANEL_ITEMS: { id: SidebarPanel; label: string; icon: React.ReactNode }[] = [
  { id: 'collections', label: 'Collections', icon: <FolderIcon fontSize="small" /> },
  { id: 'history', label: 'History', icon: <HistoryIcon fontSize="small" /> },
  { id: 'openapi', label: 'Swagger / OpenAPI', icon: <DescriptionIcon fontSize="small" /> },
  { id: 'proto', label: 'Proto Files', icon: <ApiIcon fontSize="small" /> },
  { id: 'plugins', label: 'Plugins', icon: <ExtensionIcon fontSize="small" /> }
]

const menuHeaderSx = {
  px: 2,
  py: 0.75,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.06em',
  color: 'text.secondary',
  pointerEvents: 'none' as const
}

interface Props {
  activePanel: SidebarPanel
  activeEnvName: string | null
  onSelectPanel: (panel: SidebarPanel) => void
  onOpenEnvironments: () => void
  onImport: () => void
  onSnippet: () => void
  onCookies: () => void
}

export default function SidebarMenu({
  activePanel,
  activeEnvName,
  onSelectPanel,
  onOpenEnvironments,
  onImport,
  onSnippet,
  onCookies
}: Props) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const open = Boolean(anchor)

  const activeItem = PANEL_ITEMS.find((item) => item.id === activePanel) ?? PANEL_ITEMS[0]

  const close = () => setAnchor(null)

  const pickPanel = (panel: SidebarPanel) => {
    onSelectPanel(panel)
    close()
  }

  return (
    <Box sx={{ flexShrink: 0, borderBottom: 1, borderColor: 'divider', p: 1 }}>
      <Button
        fullWidth
        size="small"
        variant="outlined"
        color="primary"
        onClick={(e) => setAnchor(e.currentTarget)}
        startIcon={activeItem.icon}
        endIcon={<ArrowDropDownIcon />}
        sx={{
          justifyContent: 'flex-start',
          py: 0.75,
          px: 1,
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'none',
          '& .MuiButton-endIcon': { ml: 'auto' }
        }}
      >
        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activeItem.label}
        </Box>
      </Button>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          display: 'block',
          mt: 0.5,
          px: 0.5,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: 10
        }}
      >
        {activeEnvName ? `Env: ${activeEnvName}` : 'No environment'}
      </Typography>

      <Menu
        anchorEl={anchor}
        open={open}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              minWidth: anchor?.offsetWidth ?? 220,
              maxWidth: 320,
              mt: 0.5
            }
          }
        }}
      >
        <Typography component="div" sx={menuHeaderSx}>
          Environment
        </Typography>
        <MenuItem
          onClick={() => {
            onOpenEnvironments()
            close()
          }}
          sx={{ py: 0.75 }}
        >
          <ListItemIcon sx={{ minWidth: 32, color: activeEnvName ? 'primary.main' : 'text.secondary' }}>
            <PublicIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary={activeEnvName || 'No Environment'}
            secondary="Manage variables"
            primaryTypographyProps={{ fontSize: 13, fontWeight: activeEnvName ? 600 : 400 }}
            secondaryTypographyProps={{ fontSize: 11 }}
          />
        </MenuItem>

        <Divider sx={{ my: 0.5 }} />

        <Typography component="div" sx={menuHeaderSx}>
          Workspace
        </Typography>
        {PANEL_ITEMS.map((item) => (
          <MenuItem key={item.id} selected={activePanel === item.id} onClick={() => pickPanel(item.id)} sx={{ py: 0.75 }}>
            <ListItemIcon sx={{ minWidth: 32, color: activePanel === item.id ? 'primary.main' : 'text.secondary' }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 13 }} />
            {activePanel === item.id && (
              <CheckIcon fontSize="small" color="primary" sx={{ ml: 1, opacity: 0.9 }} />
            )}
          </MenuItem>
        ))}

        <Divider sx={{ my: 0.5 }} />

        <Typography component="div" sx={menuHeaderSx}>
          Tools
        </Typography>
        <MenuItem
          onClick={() => {
            onImport()
            close()
          }}
          sx={{ py: 0.75 }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <ImportExportIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Import" primaryTypographyProps={{ fontSize: 13 }} />
        </MenuItem>
        <MenuItem
          onClick={() => {
            onSnippet()
            close()
          }}
          sx={{ py: 0.75 }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <CodeIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="cURL Snippet" primaryTypographyProps={{ fontSize: 13 }} />
        </MenuItem>
        <MenuItem
          onClick={() => {
            onCookies()
            close()
          }}
          sx={{ py: 0.75 }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <CookiesIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Cookie Jar" primaryTypographyProps={{ fontSize: 13 }} />
        </MenuItem>
      </Menu>
    </Box>
  )
}
