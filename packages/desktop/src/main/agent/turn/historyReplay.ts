import { HISTORY_REPLAY_MAX_CHARS, type ChatEvent } from '@shared/types/agent'

export const HISTORY_REPLAY_LABEL = 'Previous conversation (restored by MarkText)'

/**
 * Latest user and agent text for a harness that cannot resume.
 * The label and the kept lines stay within `HISTORY_REPLAY_MAX_CHARS`.
 * Older lines are dropped first; a line that still does not fit keeps its tail.
 */
export const historyReplay = (events: readonly ChatEvent[]): string | null => {
  const lines: string[] = []
  for (const event of events) {
    if (event.type !== 'message_chunk') continue
    const text = event.text.trim()
    if (!text) continue
    lines.push(`${event.role}: ${text}`)
  }
  if (lines.length === 0) return null
  const kept: string[] = []
  let size = HISTORY_REPLAY_LABEL.length
  for (let index = lines.length - 1; index >= 0 && size < HISTORY_REPLAY_MAX_CHARS; index--) {
    const line = lines[index]
    if (!line) continue
    const gap = kept.length === 0 ? 2 : 1
    const room = HISTORY_REPLAY_MAX_CHARS - size - gap
    if (room <= 0) break
    const piece = line.length <= room ? line : line.slice(line.length - room)
    kept.push(piece)
    size += gap + piece.length
  }
  if (kept.length === 0) return HISTORY_REPLAY_LABEL
  kept.reverse()
  return `${HISTORY_REPLAY_LABEL}\n\n${kept.join('\n')}`
}
