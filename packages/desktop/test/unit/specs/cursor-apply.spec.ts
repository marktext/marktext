import { describe, it, expect, vi } from 'vitest'
import { applyCursor, isIndexCursor } from '@/util/cursor'

describe('applyCursor', () => {
  const makeEditor = () => ({
    setSelection: vi.fn(),
    setCursorByOffset: vi.fn(() => true)
  })

  it('routes a source-code index cursor to setCursorByOffset', () => {
    const editor = makeEditor()
    const cursor = { anchor: { line: 3, ch: 2 }, focus: { line: 3, ch: 5 } }

    applyCursor(editor, cursor)

    expect(editor.setCursorByOffset).toHaveBeenCalledWith(cursor)
    expect(editor.setSelection).not.toHaveBeenCalled()
  })

  it('routes a selection snapshot to setSelection', () => {
    const editor = makeEditor()
    const cursor = {
      kind: 'text',
      anchor: {
        offset: 1,
        path: [0, 'text']
      },
      focus: {
        offset: 4,
        path: [0, 'text']
      }
    }

    applyCursor(editor, cursor)

    expect(editor.setSelection).toHaveBeenCalledWith(cursor)
    expect(editor.setCursorByOffset).not.toHaveBeenCalled()
  })

  it('does nothing for a null cursor', () => {
    const editor = makeEditor()

    applyCursor(editor, null)

    expect(editor.setSelection).not.toHaveBeenCalled()
    expect(editor.setCursorByOffset).not.toHaveBeenCalled()
  })
})

describe('isIndexCursor', () => {
  it('is true only when both ends carry numeric line and ch', () => {
    expect(isIndexCursor({ anchor: { line: 0, ch: 0 }, focus: { line: 1, ch: 2 } })).toBe(true)
    expect(isIndexCursor({ anchor: { offset: 0 }, focus: { offset: 1 } })).toBe(false)
    expect(isIndexCursor({ anchor: { line: 0 }, focus: { line: 1, ch: 2 } })).toBe(false)
    expect(isIndexCursor(null)).toBe(false)
  })
})
