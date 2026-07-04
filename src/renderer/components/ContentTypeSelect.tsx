import { Autocomplete, Box, TextField, Typography } from '@mui/material'
import { memo, useMemo } from 'react'
import { CONTENT_TYPE_OPTIONS, type GroupedContentTypeOption } from '../utils/contentTypes'

interface Props {
  value: string
  onChange: (value: string) => void
}

function filterOptions(options: GroupedContentTypeOption[], inputValue: string) {
  const q = inputValue.trim().toLowerCase()
  if (!q) return options
  return options.filter(
    (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q) || o.group.toLowerCase().includes(q)
  )
}

function ContentTypeSelect({ value, onChange }: Props) {
  const selected = useMemo(
    () => CONTENT_TYPE_OPTIONS.find((o) => o.value === value) ?? null,
    [value]
  )

  return (
    <Autocomplete
      freeSolo
      size="small"
      fullWidth
      options={CONTENT_TYPE_OPTIONS}
      groupBy={(option) => option.group}
      value={selected}
      inputValue={value}
      onInputChange={(_, next, reason) => {
        if (reason === 'input' || reason === 'clear') onChange(next)
      }}
      onChange={(_, next) => {
        if (typeof next === 'string') {
          onChange(next)
          return
        }
        if (next) onChange(next.value)
      }}
      getOptionLabel={(option) => (typeof option === 'string' ? option : option.value)}
      isOptionEqualToValue={(option, val) => option.value === val.value}
      filterOptions={(options, state) => filterOptions(options, state.inputValue)}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Content-Type"
          placeholder="Search or type MIME type…"
          slotProps={{
            input: {
              ...params.InputProps,
              sx: { fontFamily: 'Consolas, monospace', fontSize: 13 }
            }
          }}
        />
      )}
      renderOption={(props, option) => {
        const { key, ...rest } = props
        return (
          <Box component="li" key={key} {...rest} sx={{ py: 0.75 }}>
            <Box>
              <Typography variant="body2">{option.label}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'Consolas, monospace' }}>
                {option.value}
              </Typography>
            </Box>
          </Box>
        )
      }}
      slotProps={{
        listbox: { sx: { maxHeight: 320 } }
      }}
    />
  )
}

export default memo(ContentTypeSelect)
