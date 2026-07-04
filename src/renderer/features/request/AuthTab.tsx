import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
  Paper
} from '@mui/material'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import VpnKeyIcon from '@mui/icons-material/VpnKey'
import PersonIcon from '@mui/icons-material/Person'
import KeyIcon from '@mui/icons-material/Key'
import SecurityIcon from '@mui/icons-material/Security'
import type { ReactNode } from 'react'
import { useRequestEditor } from '../../contexts/RequestEditorContext'
import type { AuthType, OAuthGrantType } from '@shared/types'

const AUTH_OPTIONS: { value: AuthType; label: string; icon: ReactNode; hint: string }[] = [
  { value: 'none', label: 'None', icon: <LockOpenIcon />, hint: 'No authentication' },
  { value: 'bearer', label: 'Bearer', icon: <VpnKeyIcon />, hint: 'Authorization: Bearer token' },
  { value: 'basic', label: 'Basic', icon: <PersonIcon />, hint: 'HTTP Basic username & password' },
  { value: 'apikey', label: 'API Key', icon: <KeyIcon />, hint: 'Custom header or query param' },
  { value: 'oauth2', label: 'OAuth 2', icon: <SecurityIcon />, hint: 'Token endpoint flow' }
]

export default function AuthTab() {
  const { request, patch } = useRequestEditor()
  const { authType, auth } = request

  const setAuth = (partial: Partial<typeof auth>) =>
    patch({ auth: { ...auth, ...partial } })

  const selected = AUTH_OPTIONS.find((o) => o.value === authType)

  return (
    <Box sx={{ maxWidth: 560 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Choose how this request authenticates. Values support <code>{'{{variables}}'}</code>.
      </Typography>

      <ToggleButtonGroup
        exclusive
        value={authType}
        onChange={(_, value: AuthType | null) => value && patch({ authType: value })}
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1,
          mb: 2,
          '& .MuiToggleButtonGroup-grouped': {
            border: 1,
            borderColor: 'divider',
            borderRadius: '8px !important',
            mx: '0 !important'
          }
        }}
      >
        {AUTH_OPTIONS.map((opt) => (
          <ToggleButton
            key={opt.value}
            value={opt.value}
            sx={{
              flex: '1 1 auto',
              minWidth: 88,
              py: 1,
              px: 1.5,
              flexDirection: 'column',
              gap: 0.25,
              textTransform: 'none',
              fontSize: 12,
              fontWeight: 600
            }}
          >
            {opt.icon}
            {opt.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {selected && authType !== 'none' && (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <Box sx={{ px: 2, py: 1.25, bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2">{selected.label} Auth</Typography>
            <Typography variant="caption" color="text.secondary">
              {selected.hint}
            </Typography>
          </Box>

          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {authType === 'bearer' && (
              <TextField
                fullWidth
                size="small"
                label="Bearer Token"
                placeholder="eyJhbGciOiJIUzI1NiIs..."
                value={auth.bearerToken || ''}
                onChange={(e) => setAuth({ bearerToken: e.target.value })}
                slotProps={{
                  input: { sx: { fontFamily: 'Consolas, monospace', fontSize: 13 } }
                }}
              />
            )}

            {authType === 'basic' && (
              <>
                <TextField
                  fullWidth
                  size="small"
                  label="Username"
                  value={auth.basicUsername || ''}
                  onChange={(e) => setAuth({ basicUsername: e.target.value })}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Password"
                  type="password"
                  value={auth.basicPassword || ''}
                  onChange={(e) => setAuth({ basicPassword: e.target.value })}
                />
              </>
            )}

            {authType === 'apikey' && (
              <>
                <TextField
                  fullWidth
                  size="small"
                  label="Key name"
                  placeholder="X-API-Key"
                  value={auth.apiKeyKey || ''}
                  onChange={(e) => setAuth({ apiKeyKey: e.target.value })}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Key value"
                  value={auth.apiKeyValue || ''}
                  onChange={(e) => setAuth({ apiKeyValue: e.target.value })}
                  slotProps={{
                    input: { sx: { fontFamily: 'Consolas, monospace', fontSize: 13 } }
                  }}
                />
                <FormControl fullWidth size="small">
                  <InputLabel>Add to</InputLabel>
                  <Select
                    value={auth.apiKeyIn || 'header'}
                    label="Add to"
                    onChange={(e) => setAuth({ apiKeyIn: e.target.value as 'header' | 'query' })}
                  >
                    <MenuItem value="header">Header</MenuItem>
                    <MenuItem value="query">Query Params</MenuItem>
                  </Select>
                </FormControl>
              </>
            )}

            {authType === 'oauth2' && (
              <>
                <FormControl fullWidth size="small">
                  <InputLabel>Grant Type</InputLabel>
                  <Select
                    value={auth.oauthGrantType || 'client_credentials'}
                    label="Grant Type"
                    onChange={(e) => setAuth({ oauthGrantType: e.target.value as OAuthGrantType })}
                  >
                    <MenuItem value="client_credentials">Client Credentials</MenuItem>
                    <MenuItem value="password">Password</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  fullWidth
                  size="small"
                  label="Token URL"
                  placeholder="https://auth.example.com/oauth/token"
                  value={auth.oauthTokenUrl || ''}
                  onChange={(e) => setAuth({ oauthTokenUrl: e.target.value })}
                />
                <Divider />
                <TextField
                  fullWidth
                  size="small"
                  label="Client ID"
                  value={auth.oauthClientId || ''}
                  onChange={(e) => setAuth({ oauthClientId: e.target.value })}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Client Secret"
                  type="password"
                  value={auth.oauthClientSecret || ''}
                  onChange={(e) => setAuth({ oauthClientSecret: e.target.value })}
                />
                {auth.oauthGrantType === 'password' && (
                  <>
                    <TextField
                      fullWidth
                      size="small"
                      label="Username"
                      value={auth.oauthUsername || ''}
                      onChange={(e) => setAuth({ oauthUsername: e.target.value })}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      label="Password"
                      type="password"
                      value={auth.oauthPassword || ''}
                      onChange={(e) => setAuth({ oauthPassword: e.target.value })}
                    />
                  </>
                )}
                <TextField
                  fullWidth
                  size="small"
                  label="Scope (optional)"
                  placeholder="read write"
                  value={auth.oauthScope || ''}
                  onChange={(e) => setAuth({ oauthScope: e.target.value })}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Access Token override (optional)"
                  value={auth.oauthAccessToken || ''}
                  onChange={(e) => setAuth({ oauthAccessToken: e.target.value })}
                  helperText="Skip token request and use this token directly"
                  slotProps={{
                    input: { sx: { fontFamily: 'Consolas, monospace', fontSize: 13 } }
                  }}
                />
              </>
            )}
          </Box>
        </Paper>
      )}

      {authType === 'none' && (
        <Box
          sx={{
            py: 3,
            px: 2,
            textAlign: 'center',
            border: 1,
            borderStyle: 'dashed',
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'action.hover'
          }}
        >
          <LockOpenIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            This request is sent without authentication headers
          </Typography>
        </Box>
      )}
    </Box>
  )
}
