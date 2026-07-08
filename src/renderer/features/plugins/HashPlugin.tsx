import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { useState } from 'react'
import { HASH_ALGORITHMS, hashText, type HashAlgorithm, type HashOutputFormat } from '../../utils/hash-tools'
import { COMPACT } from '../../theme/compact'

export default function HashPlugin() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>('SHA-256')
  const [format, setFormat] = useState<HashOutputFormat>('hex')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setError(null)
    setBusy(true)
    try {
      setOutput(await hashText(input, algorithm, format))
    } catch (err) {
      setOutput('')
      setError(err instanceof Error ? err.message : 'Hash failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Stack spacing={1.25}>
      <Typography variant="caption" color="text.secondary">
        Generate SHA-256, SHA-384, or SHA-512 hash from plain text.
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Algorithm</InputLabel>
          <Select label="Algorithm" value={algorithm} onChange={(e) => setAlgorithm(e.target.value as HashAlgorithm)}>
            {HASH_ALGORITHMS.map((item) => (
              <MenuItem key={item.id} value={item.id}>
                {item.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 110 }}>
          <InputLabel>Output</InputLabel>
          <Select label="Output" value={format} onChange={(e) => setFormat(e.target.value as HashOutputFormat)}>
            <MenuItem value="hex">Hex</MenuItem>
            <MenuItem value="base64">Base64</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <TextField label="Input" value={input} onChange={(e) => setInput(e.target.value)} multiline minRows={4} fullWidth size="small" sx={COMPACT.monoInput} />

      <Button size="small" variant="contained" onClick={() => void run()} disabled={busy}>
        Hash
      </Button>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
        <TextField label="Output" value={output} multiline minRows={3} fullWidth size="small" InputProps={{ readOnly: true }} sx={COMPACT.monoInput} />
        {output && (
          <Button size="small" startIcon={<ContentCopyIcon />} onClick={() => void navigator.clipboard.writeText(output)}>
            Copy
          </Button>
        )}
      </Box>
    </Stack>
  )
}
