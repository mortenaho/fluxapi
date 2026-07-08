import { Box, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material'
import { useState } from 'react'
import { PLUGINS } from './registry'

export default function PluginsPanel() {
  const [activeId, setActiveId] = useState(PLUGINS[0]?.id ?? '')
  const active = PLUGINS.find((plugin) => plugin.id === activeId) ?? PLUGINS[0]
  const ActiveComponent = active?.component

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <List dense disablePadding sx={{ flexShrink: 0, borderBottom: 1, borderColor: 'divider', pb: 0.5 }}>
        {PLUGINS.map((plugin) => {
          const Icon = plugin.icon
          const selected = plugin.id === active?.id
          return (
            <ListItemButton
              key={plugin.id}
              selected={selected}
              onClick={() => setActiveId(plugin.id)}
              sx={{ py: 0.75, borderRadius: 1, mx: 0.5 }}
            >
              <ListItemIcon sx={{ minWidth: 30 }}>
                <Icon sx={{ fontSize: 18, color: selected ? 'primary.main' : 'text.secondary' }} />
              </ListItemIcon>
              <ListItemText
                primary={plugin.name}
                secondary={plugin.description}
                primaryTypographyProps={{ fontSize: 12, fontWeight: selected ? 700 : 500 }}
                secondaryTypographyProps={{ fontSize: 10, noWrap: true }}
              />
            </ListItemButton>
          )
        })}
      </List>

      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0, p: 1.25 }}>
        {active && (
          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13, mb: 1 }}>
            {active.name}
          </Typography>
        )}
        {ActiveComponent && <ActiveComponent />}
      </Box>
    </Box>
  )
}
