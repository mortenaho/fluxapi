import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { useState } from 'react'
import { decodeJwt, formatJwtJson } from '../../utils/jwt-tools'
import { COMPACT } from '../../theme/compact'

export default function JwtPlugin() {
  const [token, setToken] = useState('')
  const [header, setHeader] = useState('')
  const [payload, setPayload] = useState('')
  const [signature, setSignature] = useState('')
  const [error, setError] = useState<string | null>(null)

  const run = () => {
    setError(null)
    try {
      const decoded = decodeJwt(token)
      setHeader(formatJwtJson(decoded.header.json))
      setPayload(formatJwtJson(decoded.payload.json))
      setSignature(decoded.signature || '(none)')
    } catch (err) {
      setHeader('')
      setPayload('')
      setSignature('')
      setError(err instanceof Error ? err.message : 'Failed to decode JWT')
    }
  }

  return (
    <Stack spacing={1.25}>
      <Typography variant="caption" color="text.secondary">
        Decode JWT header and payload. Signature is shown but not verified.
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

      <TextField
        label="JWT token"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        multiline
        minRows={3}
        fullWidth
        size="small"
        sx={COMPACT.monoInput}
      />

      <Button size="small" variant="contained" onClick={run}>
        Decode
      </Button>

      <TextField label="Header" value={header} multiline minRows={3} fullWidth size="small" InputProps={{ readOnly: true }} sx={COMPACT.monoInput} />
      <TextField label="Payload" value={payload} multiline minRows={4} fullWidth size="small" InputProps={{ readOnly: true }} sx={COMPACT.monoInput} />
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField label="Signature" value={signature} fullWidth size="small" InputProps={{ readOnly: true }} sx={COMPACT.monoInput} />
        {signature && (
          <Button size="small" startIcon={<ContentCopyIcon />} onClick={() => void navigator.clipboard.writeText(signature)}>
            Copy
          </Button>
        )}
      </Box>
    </Stack>
  )
}
