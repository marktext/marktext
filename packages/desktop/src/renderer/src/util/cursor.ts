import type { Muya, TSelectionState } from '@muyajs/core'

// Source-mode cursors use zero-based line/ch pairs. Both coordinates are required
// so the engine does not silently restore the caret to column zero.
interface IndexPosition {
  line: number
  ch: number
}

export interface IndexCursor {
  anchor: IndexPosition
  focus: IndexPosition
}

const isIndexPosition = (pos: unknown): pos is IndexPosition => {
  const p = pos as { line?: unknown; ch?: unknown } | null
  return !!p && typeof p.line === 'number' && typeof p.ch === 'number'
}

export const isIndexCursor = (cursor: unknown): cursor is IndexCursor => {
  const c = cursor as { anchor?: unknown; focus?: unknown } | null
  return !!c && isIndexPosition(c.anchor) && isIndexPosition(c.focus)
}

type CursorEditor = Pick<Muya, 'setSelection' | 'setCursorByOffset'>

// The source editor stores line/ch coordinates; Muya stores a selection state.
export const applyCursor = (editor: CursorEditor, cursor: unknown): void => {
  if (isIndexCursor(cursor)) {
    editor.setCursorByOffset(cursor)
  } else if (cursor) {
    editor.setSelection(cursor as TSelectionState)
  }
}
