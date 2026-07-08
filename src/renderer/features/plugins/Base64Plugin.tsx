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
import { decodeBase64, encodeBase64 } from '../../utils/base64'
import { COMPACT } from '../../theme/compact'

export default function Base64Plugin() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [urlSafe, setUrlSafe] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = (mode: 'encode' | 'decode') => {
    setError(null)
    try {
      setOutput(mode === 'encode' ? encodeBase64(input, urlSafe) : decodeBase64(input, urlSafe))
    } catch (err) {
      setOutput('')
      setError(err instanceof Error ? err.message : 'Failed to process input')
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
        Convert plain text to Base64 and back. Supports URL-safe encoding.
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

      <TextField
        label="Input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        multiline
        minRows={4}
        fullWidth
        size="small"
        sx={COMPACT.monoInput}
      />

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
          control={<Switch size="small" checked={urlSafe} onChange={(e) => setUrlSafe(e.target.checked)} />}
          label={<Typography variant="caption">URL-safe</Typography>}
        />
      </Box>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
        <TextField
          label="Output"
          value={output}
          multiline
          minRows={4}
          fullWidth
          size="small"
          InputProps={{ readOnly: true }}
          sx={COMPACT.monoInput}
        />
        {output && (
          <Button size="small" startIcon={<ContentCopyIcon />} onClick={() => void navigator.clipboard.writeText(output)}>
            Copy
          </Button>
        )}
      </Box>
    </Stack>
  )
}
