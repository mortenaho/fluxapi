import {
  Box,
  InputBase,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Popper,
  Typography,
  useTheme
} from '@mui/material'
import type { Theme } from '@mui/material/styles'
import AddIcon from '@mui/icons-material/Add'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { KeyValue } from '@shared/types'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../stores/appStore'
import {
  buildVariableMap,
  collectVariableNames,
  getAutocompleteContext,
  parseVariableSegments,
  type VariableSegment
} from '../utils/variables'

const EMPTY_VARS: KeyValue[] = []
const VARIABLE_CHIP_PAD_X = 2

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  collectionVariables?: KeyValue[]
  fullWidth?: boolean
  /** Reset local text when the owning request/editor changes. */
  syncKey?: string
}

const INPUT_PADDING = '4px 8px'

let measureCanvas: HTMLCanvasElement | null = null

function measureTextRun(text: string, style: CSSStyleDeclaration, fontWeight: number | string): number {
  if (!text) return 0
  if (!measureCanvas) measureCanvas = document.createElement('canvas')
  const ctx = measureCanvas.getContext('2d')
  if (!ctx) return 0
  ctx.font = `${fontWeight} ${style.fontSize} ${style.fontFamily}`
  const width = ctx.measureText(text).width
  const fontSize = parseFloat(style.fontSize)
  const letterSpacing = fontSize * 0.00938 * Math.max(0, text.length - 1)
  return width + letterSpacing
}

function findVariableAtOffsetX(
  segments: VariableSegment[],
  style: CSSStyleDeclaration,
  offsetX: number
): { segment: VariableSegment; centerX: number } | null {
  let x = 0
  for (const seg of segments) {
    const weight = seg.type === 'variable' ? 600 : 400
    const runWidth = measureTextRun(seg.content, style, weight)
    const extra = seg.type === 'variable' ? VARIABLE_CHIP_PAD_X : 0
    const total = runWidth + extra
    if (offsetX >= x && offsetX <= x + total) {
      return seg.type === 'variable' ? { segment: seg, centerX: x + total / 2 } : null
    }
    x += total
  }
  return null
}

function variableColor(source: VariableSegment['source'], theme: Theme): string {
  switch (source) {
    case 'environment':
      return theme.palette.warning.main
    case 'collection':
      return theme.palette.info.main
    case 'dynamic':
      return theme.palette.primary.main
    default:
      return theme.palette.error.main
  }
}

function variableTooltip(segment: VariableSegment): string {
  if (!segment.name) return segment.content
  if (segment.source === 'dynamic') return `${segment.name} — resolved at send time`
  if (segment.source === 'unknown' || segment.resolvedValue === undefined) {
    return `${segment.name} — not set`
  }
  const value = segment.resolvedValue || '(empty)'
  const source =
    segment.source === 'environment' ? 'Environment' : segment.source === 'collection' ? 'Collection' : 'Variable'
  return `${segment.name}\n${source}: ${value}`
}

function VariableInput({
  value,
  onChange,
  placeholder,
  collectionVariables = [],
  fullWidth = true,
  syncKey
}: Props) {
  const theme = useTheme()
  const focusedRef = useRef(false)
  const [text, setText] = useState(value)
  const { activeEnvId, activeEnvName, envVars } = useAppStore(
    useShallow((s) => {
      const env = s.environments.find((e) => e.isActive)
      return {
        activeEnvId: env?.id ?? null,
        activeEnvName: env?.name ?? '',
        envVars: env?.variables ?? EMPTY_VARS
      }
    })
  )
  const loadEnvironments = useAppStore((s) => s.loadEnvironments)

  useEffect(() => {
    if (!focusedRef.current) setText(value)
  }, [value])

  useEffect(() => {
    setText(value)
    focusedRef.current = false
  }, [syncKey])

  const inputRef = useRef<HTMLInputElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)
  const [focused, setFocused] = useState(false)
  const [hoverSegment, setHoverSegment] = useState<VariableSegment | null>(null)
  const [tooltipAnchor, setTooltipAnchor] = useState<{ x: number; y: number } | null>(null)
  const [acOpen, setAcOpen] = useState(false)
  const [acIndex, setAcIndex] = useState(0)
  const [acContext, setAcContext] = useState<ReturnType<typeof getAutocompleteContext>>(null)

  const envVarsList = envVars
  const varMap = useMemo(() => buildVariableMap(envVarsList, collectionVariables), [envVarsList, collectionVariables])
  const segments = useMemo(
    () => parseVariableSegments(text, envVarsList, collectionVariables),
    [text, envVarsList, collectionVariables]
  )

  const suggestions = useMemo(() => {
    if (!acContext) return []
    const q = acContext.query.toLowerCase()
    const allNames = collectVariableNames(envVarsList, collectionVariables)
    const matches = allNames.filter((n) => n.toLowerCase().includes(q))
    const items: { type: 'var' | 'create'; name: string; subtitle?: string }[] = matches.map((name) => ({
      type: 'var',
      name,
      subtitle: varMap.get(name) || '(empty)'
    }))
    const exact = matches.some((n) => n === acContext.query)
    if (acContext.query && !exact && activeEnvId) {
      items.push({
        type: 'create',
        name: acContext.query,
        subtitle: `Add to "${activeEnvName}"`
      })
    }
    return items
  }, [acContext, envVarsList, collectionVariables, varMap, activeEnvId, activeEnvName])

  const refreshAutocomplete = useCallback(() => {
    const input = inputRef.current
    if (!input || !focused) {
      setAcContext(null)
      setAcOpen(false)
      return
    }
    const pos = input.selectionStart ?? 0
    const ctx = getAutocompleteContext(text, pos)
    setAcContext(ctx)
    if (!ctx) {
      setAcOpen(false)
      return
    }
    const q = ctx.query.toLowerCase()
    const allNames = collectVariableNames(envVarsList, collectionVariables)
    const matches = allNames.filter((n) => n.toLowerCase().includes(q))
    const hasCreate = !!ctx.query && !matches.some((n) => n === ctx.query) && !!activeEnvId
    setAcOpen(matches.length > 0 || hasCreate)
    setAcIndex(0)
  }, [focused, text, envVarsList, collectionVariables, activeEnvId])

  const syncScroll = useCallback(() => {
    if (highlightRef.current && inputRef.current) {
      highlightRef.current.scrollLeft = inputRef.current.scrollLeft
    }
  }, [])

  const insertVariable = useCallback(
    (name: string) => {
      if (!acContext) return
      const before = text.slice(0, acContext.replaceStart)
      const after = text.slice(acContext.replaceEnd)
      const next = `${before}${name}}}${after}`
      setText(next)
      onChange(next)
      setAcOpen(false)
      const newCursor = before.length + name.length + 2
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.setSelectionRange(newCursor, newCursor)
        refreshAutocomplete()
      })
    },
    [acContext, onChange, text, refreshAutocomplete]
  )

  const createAndInsertVariable = useCallback(
    async (name: string) => {
      if (!activeEnvId || !name.trim()) return
      const trimmed = name.trim()
      const activeEnv = useAppStore.getState().environments.find((e) => e.id === activeEnvId)
      if (!activeEnv) return
      const exists = activeEnv.variables.some((v) => v.key === trimmed)
      if (!exists) {
        await window.fluxAPI.environments.save({
          ...activeEnv,
          variables: [...activeEnv.variables, { id: uuidv4(), key: trimmed, value: '', enabled: true }]
        })
        await loadEnvironments()
      }
      insertVariable(trimmed)
    },
    [activeEnvId, insertVariable, loadEnvironments]
  )

  const handleMouseMove = (e: React.MouseEvent<HTMLInputElement>) => {
    const input = inputRef.current
    if (!input) return
    const rect = input.getBoundingClientRect()
    const style = window.getComputedStyle(input)
    const padL = parseFloat(style.paddingLeft)
    const offsetX = e.clientX - rect.left - padL + input.scrollLeft
    const hit = findVariableAtOffsetX(segments, style, offsetX)
    if (hit) {
      setHoverSegment(hit.segment)
      setTooltipAnchor({
        x: rect.left + padL + hit.centerX - input.scrollLeft,
        y: rect.bottom
      })
    } else {
      setHoverSegment(null)
      setTooltipAnchor(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!acOpen || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAcIndex((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAcIndex((i) => (i - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const item = suggestions[acIndex]
      if (item.type === 'create') void createAndInsertVariable(item.name)
      else insertVariable(item.name)
    } else if (e.key === 'Escape') {
      setAcOpen(false)
    }
  }

  const borderColor = focused ? theme.palette.primary.main : theme.palette.divider

  return (
    <Box sx={{ position: 'relative', flex: fullWidth ? 1 : undefined, minWidth: 0 }}>
      <Box
        sx={{
          position: 'relative',
          border: 1,
          borderColor,
          borderRadius: 1,
          bgcolor: 'background.paper',
          '&:hover': { borderColor: focused ? theme.palette.primary.main : theme.palette.text.primary }
        }}
      >
        <Box
          ref={highlightRef}
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            px: '8px',
            py: '4px',
            fontSize: '0.75rem',
            fontFamily: theme.typography.fontFamily,
            lineHeight: '1.4375em',
            letterSpacing: '0.00938em',
            whiteSpace: 'pre',
            overflow: 'hidden',
            pointerEvents: 'none',
            color: 'text.primary'
          }}
        >
          {text ? (
            segments.map((seg, i) =>
              seg.type === 'variable' ? (
                <Box
                  key={i}
                  component="span"
                  sx={{
                    color: variableColor(seg.source, theme),
                    fontWeight: 600,
                    bgcolor: `${variableColor(seg.source, theme)}18`,
                    borderRadius: '3px',
                    px: '1px'
                  }}
                >
                  {seg.content}
                </Box>
              ) : (
                <span key={i}>{seg.content}</span>
              )
            )
          ) : (
            <Box component="span" sx={{ color: 'text.disabled' }}>
              {placeholder}
            </Box>
          )}
        </Box>

        <InputBase
          inputRef={inputRef}
          fullWidth
          value={text}
          placeholder=""
          onChange={(e) => {
            const next = e.target.value
            setText(next)
            onChange(next)
            requestAnimationFrame(refreshAutocomplete)
          }}
          onFocus={() => {
            focusedRef.current = true
            setFocused(true)
          }}
          onBlur={() => {
            focusedRef.current = false
            setFocused(false)
            setTimeout(() => setAcOpen(false), 150)
            setHoverSegment(null)
            setTooltipAnchor(null)
          }}
          onKeyDown={handleKeyDown}
          onKeyUp={refreshAutocomplete}
          onClick={refreshAutocomplete}
          onSelect={refreshAutocomplete}
          onScroll={syncScroll}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => {
            setHoverSegment(null)
            setTooltipAnchor(null)
          }}
          sx={{
            width: '100%',
            fontSize: '0.75rem',
            position: 'relative',
            zIndex: 1,
            '& .MuiInputBase-input': {
              padding: INPUT_PADDING,
              color: 'transparent',
              backgroundColor: 'transparent',
              caretColor: theme.palette.text.primary
            }
          }}
        />
      </Box>

      {hoverSegment && tooltipAnchor && (
        <Paper
          elevation={4}
          sx={{
            position: 'fixed',
            top: tooltipAnchor.y + 6,
            left: tooltipAnchor.x,
            transform: 'translateX(-50%)',
            zIndex: 1400,
            px: 1.5,
            py: 1,
            maxWidth: 360,
            pointerEvents: 'none'
          }}
        >
          <Typography variant="caption" component="pre" sx={{ whiteSpace: 'pre-wrap', m: 0, fontFamily: 'monospace' }}>
            {variableTooltip(hoverSegment)}
          </Typography>
        </Paper>
      )}

      <Popper open={acOpen} anchorEl={inputRef.current} placement="bottom-start" style={{ zIndex: 1300 }}>
        <Paper elevation={6} sx={{ mt: 0.5, minWidth: 220, maxWidth: 360, maxHeight: 240, overflow: 'auto' }}>
          <List dense disablePadding>
            {suggestions.map((item, i) => (
              <ListItemButton
                key={`${item.type}-${item.name}`}
                selected={i === acIndex}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (item.type === 'create') void createAndInsertVariable(item.name)
                  else insertVariable(item.name)
                }}
              >
                {item.type === 'create' ? <AddIcon fontSize="small" sx={{ mr: 1, opacity: 0.7 }} /> : null}
                <ListItemText
                  primary={item.type === 'create' ? `Create "${item.name}"` : item.name}
                  secondary={item.subtitle}
                  primaryTypographyProps={{ variant: 'body2', fontFamily: 'monospace' }}
                  secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      </Popper>
    </Box>
  )
}

export default memo(VariableInput)
