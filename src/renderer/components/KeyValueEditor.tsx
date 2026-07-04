import {
  Box,
  TextField,
  IconButton,
  Checkbox,
  Button,
  Tooltip,
  Typography,
  Chip
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import { memo, useCallback, useMemo } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { KeyValue } from '@shared/types'
import { COMPACT } from '../theme/compact'

interface Props {
  items: KeyValue[]
  onChange: (items: KeyValue[]) => void
  keyLabel?: string
  valueLabel?: string
  allowFiles?: boolean
  description?: string
  emptyTitle?: string
  emptyHint?: string
  keyPlaceholder?: string
  valuePlaceholder?: string
}

interface RowProps {
  item: KeyValue
  index: number
  allowFiles: boolean
  keyPlaceholder: string
  valuePlaceholder: string
  onFieldChange: (index: number, field: keyof KeyValue, value: string | boolean) => void
  onPickFile: (index: number) => void
  onRemove: (index: number) => void
}

const KeyValueRow = memo(function KeyValueRow({
  item,
  index,
  allowFiles,
  keyPlaceholder,
  valuePlaceholder,
  onFieldChange,
  onPickFile,
  onRemove
}: RowProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: allowFiles ? '28px 1fr 1fr auto' : '28px 1fr 1fr 32px',
        gap: 0.5,
        alignItems: 'center',
        px: 0.75,
        py: 0.375,
        borderBottom: 1,
        borderColor: 'divider',
        opacity: item.enabled ? 1 : 0.45,
        transition: 'opacity 0.15s, background-color 0.15s',
        '&:hover': { bgcolor: 'action.hover' },
        '&:last-of-type': { borderBottom: 0 }
      }}
    >
      <Tooltip title={item.enabled ? 'Disable' : 'Enable'}>
        <Checkbox
          checked={item.enabled}
          onChange={(e) => onFieldChange(index, 'enabled', e.target.checked)}
          size="small"
          sx={{ p: 0.25 }}
        />
      </Tooltip>

      <TextField
        size="small"
        fullWidth
        placeholder={keyPlaceholder}
        value={item.key}
        onChange={(e) => onFieldChange(index, 'key', e.target.value)}
        sx={COMPACT.input}
        slotProps={{
          input: { sx: COMPACT.monoInput }
        }}
      />

      {allowFiles && item.filePath ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
          <Chip
            size="small"
            icon={<AttachFileIcon sx={{ fontSize: '12px !important' }} />}
            label={item.filePath.split(/[/\\]/).pop()}
            onClick={() => onPickFile(index)}
            sx={{ maxWidth: '100%', fontFamily: 'monospace', fontSize: 10, height: 22 }}
          />
        </Box>
      ) : (
        <TextField
          size="small"
          fullWidth
          placeholder={valuePlaceholder}
          value={item.value}
          onChange={(e) => onFieldChange(index, 'value', e.target.value)}
          sx={COMPACT.input}
          slotProps={{
            input: { sx: COMPACT.monoInput }
          }}
        />
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        {allowFiles && (
          <Tooltip title="Attach file">
            <IconButton size="small" onClick={() => onPickFile(index)} sx={COMPACT.iconBtn}>
              <AttachFileIcon sx={COMPACT.icon} />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Remove">
          <IconButton size="small" color="error" onClick={() => onRemove(index)} sx={COMPACT.iconBtn}>
            <DeleteOutlineIcon sx={COMPACT.icon} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  )
})

function KeyValueEditor({
  items,
  onChange,
  keyLabel = 'Key',
  valueLabel = 'Value',
  allowFiles = false,
  description,
  emptyTitle = 'No entries yet',
  emptyHint = 'Add key-value pairs below',
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value'
}: Props) {
  const enabledCount = useMemo(() => items.filter((i) => i.enabled && i.key.trim()).length, [items])

  const onFieldChange = useCallback(
    (index: number, field: keyof KeyValue, value: string | boolean) => {
      onChange(items.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
    },
    [items, onChange]
  )

  const add = useCallback(
    () => onChange([...items, { id: uuidv4(), key: '', value: '', enabled: true }]),
    [items, onChange]
  )

  const remove = useCallback(
    (index: number) => onChange(items.filter((_, i) => i !== index)),
    [items, onChange]
  )

  const pickFile = useCallback(
    async (index: number) => {
      const filePath = await window.fluxAPI.dialog.openFile([{ name: 'All Files', extensions: ['*'] }])
      if (!filePath) return
      onChange(
        items.map((row, i) =>
          i === index ? { ...row, filePath, value: filePath.split(/[/\\]/).pop() || '' } : row
        )
      )
    },
    [items, onChange]
  )

  const setAllEnabled = useCallback(
    (enabled: boolean) => onChange(items.map((row) => ({ ...row, enabled }))),
    [items, onChange]
  )

  const clearAll = useCallback(() => onChange([]), [onChange])

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          mb: 0.75,
          flexWrap: 'wrap'
        }}
      >
        <Box sx={{ flex: 1, minWidth: 160 }}>
          {description && (
            <Typography sx={COMPACT.caption}>{description}</Typography>
          )}
          {items.length > 0 && (
            <Typography sx={{ ...COMPACT.caption, display: 'block', mt: description ? 0.25 : 0 }}>
              {enabledCount} active · {items.length} total
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 0.25, flexWrap: 'wrap' }}>
          {items.length > 0 && (
            <>
              <Button size="small" variant="text" onClick={() => setAllEnabled(true)} sx={{ fontSize: 10, py: 0.25, minWidth: 0 }}>
                All on
              </Button>
              <Button size="small" variant="text" onClick={() => setAllEnabled(false)} sx={{ fontSize: 10, py: 0.25, minWidth: 0 }}>
                All off
              </Button>
              <Button size="small" variant="text" color="error" onClick={clearAll} sx={{ fontSize: 10, py: 0.25, minWidth: 0 }}>
                Clear
              </Button>
            </>
          )}
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon sx={{ fontSize: 14 }} />}
            onClick={add}
            sx={COMPACT.btnSmall}
          >
            Add
          </Button>
        </Box>
      </Box>

      {items.length === 0 ? (
        <Box
          sx={{
            py: 1.5,
            px: 1,
            textAlign: 'center',
            border: 1,
            borderStyle: 'dashed',
            borderColor: 'divider',
            borderRadius: 0.75,
            bgcolor: 'action.hover'
          }}
        >
          <Typography sx={{ ...COMPACT.caption, fontWeight: 600, display: 'block', mb: 0.25 }}>
            {emptyTitle}
          </Typography>
          <Typography sx={{ ...COMPACT.caption, display: 'block', mb: 0.75 }}>
            {emptyHint}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon sx={{ fontSize: 14 }} />}
            onClick={add}
            sx={COMPACT.btnSmall}
          >
            Add row
          </Button>
        </Box>
      ) : (
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 0.75, overflow: 'hidden' }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: allowFiles ? '28px 1fr 1fr auto' : '28px 1fr 1fr 32px',
              gap: 0.5,
              alignItems: 'center',
              px: 0.75,
              py: 0.375,
              bgcolor: 'action.selected',
              borderBottom: 1,
              borderColor: 'divider'
            }}
          >
            <Box />
            <Typography sx={{ ...COMPACT.caption, fontWeight: 700, textTransform: 'uppercase' }}>
              {keyLabel}
            </Typography>
            <Typography sx={{ ...COMPACT.caption, fontWeight: 700, textTransform: 'uppercase' }}>
              {valueLabel}
            </Typography>
            <Box />
          </Box>

          {items.map((item, i) => (
            <KeyValueRow
              key={item.id}
              item={item}
              index={i}
              allowFiles={allowFiles}
              keyPlaceholder={keyPlaceholder}
              valuePlaceholder={valuePlaceholder}
              onFieldChange={onFieldChange}
              onPickFile={pickFile}
              onRemove={remove}
            />
          ))}
        </Box>
      )}
    </Box>
  )
}

export default memo(KeyValueEditor)
