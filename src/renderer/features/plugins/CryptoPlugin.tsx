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
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { useState } from 'react'
import {
  CRYPTO_ALGORITHMS,
  decryptText,
  encryptText,
  type CryptoAlgorithmId,
  type KeyFormat
} from '../../utils/crypto-tools'
import { COMPACT } from '../../theme/compact'

export default function CryptoPlugin() {
  const [mode, setMode] = useState<'encrypt' | 'decrypt'>('encrypt')
  const [algorithm, setAlgorithm] = useState<CryptoAlgorithmId>('AES-256-GCM')
  const [keyFormat, setKeyFormat] = useState<KeyFormat>('text')
  const [ivFormat, setIvFormat] = useState<KeyFormat>('hex')
  const [key, setKey] = useState('')
  const [iv, setIv] = useState('')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [lastIv, setLastIv] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setError(null)
    setBusy(true)
    try {
      if (!key.trim()) throw new Error('Key is required')

      if (mode === 'encrypt') {
        const result = await encryptText({
          text: input,
          algorithm,
          key,
          keyFormat,
          iv: iv || undefined,
          ivFormat
        })
        setOutput(result.output)
        setLastIv(result.iv)
      } else {
        const plain = await decryptText({
          payload: input,
          algorithm,
          key,
          keyFormat,
          iv: iv || undefined,
          ivFormat
        })
        setOutput(plain)
      }
    } catch (err) {
      setOutput('')
      setError(err instanceof Error ? err.message : 'Crypto operation failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Stack spacing={1.25}>
      <Typography variant="caption" color="text.secondary">
        Encrypt and decrypt text with AES. Text keys are hashed with SHA-256. Encrypted output format:{' '}
        <Box component="span" sx={{ fontFamily: 'monospace' }}>
          base64(iv).base64(ciphertext)
        </Box>
        .
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}
      {lastIv && mode === 'encrypt' && (
        <Alert severity="info" sx={{ py: 0.25 }}>
          IV (hex): <Box component="span" sx={{ fontFamily: 'monospace' }}>{lastIv}</Box>
        </Alert>
      )}

      <ToggleButtonGroup
        exclusive
        size="small"
        value={mode}
        onChange={(_, value) => value && setMode(value)}
      >
        <ToggleButton value="encrypt">Encrypt</ToggleButton>
        <ToggleButton value="decrypt">Decrypt</ToggleButton>
      </ToggleButtonGroup>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Algorithm</InputLabel>
          <Select label="Algorithm" value={algorithm} onChange={(e) => setAlgorithm(e.target.value as CryptoAlgorithmId)}>
            {CRYPTO_ALGORITHMS.map((item) => (
              <MenuItem key={item.id} value={item.id}>
                {item.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 110 }}>
          <InputLabel>Key format</InputLabel>
          <Select label="Key format" value={keyFormat} onChange={(e) => setKeyFormat(e.target.value as KeyFormat)}>
            <MenuItem value="text">Text</MenuItem>
            <MenuItem value="hex">Hex</MenuItem>
            <MenuItem value="base64">Base64</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 110 }}>
          <InputLabel>IV format</InputLabel>
          <Select label="IV format" value={ivFormat} onChange={(e) => setIvFormat(e.target.value as KeyFormat)}>
            <MenuItem value="hex">Hex</MenuItem>
            <MenuItem value="base64">Base64</MenuItem>
            <MenuItem value="text">Text</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <TextField
        label="Key"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        fullWidth
        size="small"
        type="password"
        sx={COMPACT.monoInput}
      />

      <TextField
        label={mode === 'encrypt' ? 'IV (optional, auto-generated if empty)' : 'IV (optional if embedded in payload)'}
        value={iv}
        onChange={(e) => setIv(e.target.value)}
        fullWidth
        size="small"
        sx={COMPACT.monoInput}
      />

      <TextField
        label={mode === 'encrypt' ? 'Plain text' : 'Encrypted payload'}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        multiline
        minRows={4}
        fullWidth
        size="small"
        sx={COMPACT.monoInput}
      />

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button size="small" variant="contained" onClick={() => void run()} disabled={busy}>
          {mode === 'encrypt' ? 'Encrypt' : 'Decrypt'}
        </Button>
        {output && (
          <Button size="small" startIcon={<ContentCopyIcon />} onClick={() => void navigator.clipboard.writeText(output)}>
            Copy output
          </Button>
        )}
      </Box>

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
    </Stack>
  )
}
