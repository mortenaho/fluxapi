import { TextField } from '@mui/material'
import Editor from '@monaco-editor/react'
import { memo, useCallback } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  language?: string
  height?: string
  minRows?: number
  editorKey?: string
}

function FallbackEditor({
  value,
  onChange,
  height = '200px',
  minRows = 10
}: Pick<Props, 'value' | 'onChange' | 'height' | 'minRows'>) {
  return (
    <TextField
      multiline
      fullWidth
      minRows={minRows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      sx={{
        '& .MuiInputBase-root': {
          fontFamily: 'Consolas, "Courier New", monospace',
          fontSize: 11,
          alignItems: 'flex-start',
          py: 0.5
        },
        '& textarea': {
          minHeight: height,
          lineHeight: 1.35
        }
      }}
    />
  )
}

function CodeEditor({
  value,
  onChange,
  language = 'json',
  height = '200px',
  minRows = 10,
  editorKey
}: Props) {
  const handleChange = useCallback((v: string | undefined) => onChange(v || ''), [onChange])

  return (
    <Editor
      key={editorKey}
      height={height}
      language={language}
      value={value}
      onChange={handleChange}
      loading={<FallbackEditor value={value} onChange={onChange} height={height} minRows={minRows} />}
      options={{
        minimap: { enabled: false },
        fontSize: 11,
        lineHeight: 16,
        scrollBeyondLastLine: false,
        padding: { top: 4, bottom: 4 },
        scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 }
      }}
    />
  )
}

export default memo(CodeEditor)
