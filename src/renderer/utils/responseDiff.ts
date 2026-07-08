export interface DiffLine {
  type: 'same' | 'add' | 'remove'
  text: string
}

export function diffText(left: string, right: string): DiffLine[] {
  const leftLines = left.split('\n')
  const rightLines = right.split('\n')
  const max = Math.max(leftLines.length, rightLines.length)
  const result: DiffLine[] = []

  for (let i = 0; i < max; i++) {
    const a = leftLines[i]
    const b = rightLines[i]
    if (a === b) {
      if (a !== undefined) result.push({ type: 'same', text: a })
      continue
    }
    if (a !== undefined) result.push({ type: 'remove', text: a })
    if (b !== undefined) result.push({ type: 'add', text: b })
  }

  return result
}

export function formatBodiesForDiff(body: string, contentType: string): { left: string; right: string } {
  if (contentType.includes('json')) {
    try {
      return { left: JSON.stringify(JSON.parse(body), null, 2), right: '' }
    } catch {
      return { left: body, right: '' }
    }
  }
  return { left: body, right: '' }
}

export function prettyJson(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
  }
}
