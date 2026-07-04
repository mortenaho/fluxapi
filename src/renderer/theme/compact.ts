export const COMPACT = {
  bar: { px: 1, py: 0.25, minHeight: 26, flexShrink: 0 },
  caption: { fontSize: 10, lineHeight: 1.2, color: 'text.secondary' },
  chip: { height: 20, fontSize: 10, '& .MuiChip-label': { px: 0.75 } },
  iconBtn: { p: 0.25 },
  icon: { fontSize: 14 },
  tabRoot: {
    minHeight: 28,
    minWidth: 48,
    py: 0,
    px: 1,
    fontSize: 11,
    textTransform: 'none' as const,
    fontWeight: 500
  },
  panel: { m: 0.5, borderRadius: 0.75 },
  input: {
    '& .MuiInputBase-root': { height: 28, py: 0 },
    '& .MuiInputBase-input': { py: 0.375, px: 0.75, fontSize: 11 }
  },
  monoInput: { fontFamily: 'Consolas, monospace', fontSize: 11 },
  select: {
    height: 28,
    fontSize: 11,
    '& .MuiSelect-select': { py: 0.375, px: 1 }
  },
  btnSmall: { minWidth: 56, py: 0.375, px: 1.25, fontSize: 11, textTransform: 'none' as const }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
