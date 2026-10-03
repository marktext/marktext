import { HUMAN_FALLBACK_NAME } from '@shared/types/comments'

export const HARNESS_LABEL: Record<string, string> = {
  opencode: 'OpenCode',
  pi: 'Pi',
  cursor: 'Cursor'
}

export const harnessLabel = (id: string): string => HARNESS_LABEL[id] ?? id

export const personName = (written: string, userName: string): string => {
  const name = written.trim()
  if (name) return name
  const current = userName.trim()
  return current || HUMAN_FALLBACK_NAME
}

export const formatWhen = (iso: string, locale: string, justNow: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const delta = Date.now() - date.getTime()
  if (delta >= 0 && delta < 60_000) return justNow
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

export type AgentBlock =
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'pre'; text: string }

/** Lists, paragraphs, and fenced code. Text nodes only — agent text is not HTML. */
export const agentBlocks = (text: string): AgentBlock[] => {
  const blocks: AgentBlock[] = []
  const lines = text.split('\n')
  let index = 0

  while (index < lines.length) {
    const line = lines[index] ?? ''
    if (line.startsWith('```')) {
      const buf: string[] = []
      index += 1
      while (index < lines.length && !(lines[index] ?? '').startsWith('```')) {
        buf.push(lines[index] ?? '')
        index += 1
      }
      if (index < lines.length) index += 1
      blocks.push({ kind: 'pre', text: buf.join('\n') })
      continue
    }

    if (line.startsWith('- ')) {
      const items: string[] = []
      while (index < lines.length && (lines[index] ?? '').startsWith('- ')) {
        items.push((lines[index] ?? '').slice(2))
        index += 1
      }
      blocks.push({ kind: 'ul', items })
      continue
    }

    if (!line.trim()) {
      index += 1
      continue
    }

    const buf: string[] = []
    while (index < lines.length) {
      const next = lines[index] ?? ''
      if (!next.trim() || next.startsWith('```') || next.startsWith('- ')) break
      buf.push(next)
      index += 1
    }
    blocks.push({ kind: 'p', text: buf.join('\n') })
  }

  return blocks
}
