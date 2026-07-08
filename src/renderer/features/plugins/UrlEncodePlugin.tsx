import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import { useState } from 'react'
import { decodeUrl, encodeUrl } from '../../utils/hash-tools'
import { COMPACT } from '../../theme/compact'

export default function UrlEncodePlugin() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [componentOnly, setComponentOnly] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const run = (mode: 'encode' | 'decode') => {
    setError(null)
    try {
      setOutput(mode === 'encode' ? encodeUrl(input, componentOnly) : decodeUrl(input, componentOnly))
    } catch (err) {
      setOutput('')
      setError(err instanceof Error ? err.message : 'URL operation failed')
    }
  }

  const swap = () => {
    setInput(output)
    setOutput(input)
    setError(null)
  }

  return (
    <Stack spacing={1.25}>
      <Typography variant="caption" color="text.secondary">
        Encode or decode URL strings. Component mode uses encodeURIComponent; full URI mode keeps : / ? # intact.
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

      <TextField label="Input" value={input} onChange={(e) => setInput(e.target.value)} multiline minRows={4} fullWidth size="small" sx={COMPACT.monoInput} />

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button size="small" variant="contained" onClick={() => run('encode')}>
          Encode
        </Button>
        <Button size="small" variant="outlined" onClick={() => run('decode')}>
          Decode
        </Button>
        <Button size="small" startIcon={<SwapHorizIcon />} onClick={swap} disabled={!output}>
          Swap
        </Button>
        <FormControlLabel
          control={<Switch size="small" checked={componentOnly} onChange={(e) => setComponentOnly(e.target.checked)} />}
          label={<Typography variant="caption">Component only</Typography>}
        />
      </Box>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
        <TextField label="Output" value={output} multiline minRows={4} fullWidth size="small" InputProps={{ readOnly: true }} sx={COMPACT.monoInput} />
        {output && (
          <Button size="small" startIcon={<ContentCopyIcon />} onClick={() => void navigator.clipboard.writeText(output)}>
            Copy
          </Button>
        )}
      </Box>
    </Stack>
  )
}
