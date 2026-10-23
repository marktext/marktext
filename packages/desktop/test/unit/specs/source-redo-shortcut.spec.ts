import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CodeMirror from 'codemirror'
import { getSourceExtraKeys } from '@/codeMirror/keybindings'

const createRange = document.createRange.bind(document)

beforeEach(() => {
  vi.spyOn(document, 'createRange').mockImplementation(() => Object.assign(createRange(), {
    getBoundingClientRect: () => new DOMRect(),
    getClientRects: () => [] as unknown as DOMRectList
  }))
})

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

const createEditor = (isWindows: boolean) => {
  const editor = CodeMirror(document.body, {
    value: 'before',
    keyMap: 'pcDefault',
    extraKeys: getSourceExtraKeys(isWindows)
  })
  editor.setValue('after')
  editor.undo()
  return editor
}

const press = (editor: CodeMirror.Editor, keyCode: number, shiftKey = false) => {
  editor.getInputField().dispatchEvent(new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    keyCode,
    ctrlKey: true,
    shiftKey
  }))
}

describe('source mode redo shortcuts (#2183)', () => {
  it('suppresses Ctrl+Shift+Z on Windows while Ctrl+Y redoes exactly once', () => {
    const editor = createEditor(true)
    press(editor, 90, true)
    expect(editor.getValue()).toBe('before')
    expect(editor.historySize().redo).toBe(1)
    press(editor, 89)
    expect(editor.getValue()).toBe('after')
    expect(editor.historySize().redo).toBe(0)
  })

  it('preserves the Linux Ctrl+Shift+Z binding', () => {
    const editor = createEditor(false)
    press(editor, 90, true)
    expect(editor.getValue()).toBe('after')
  })
})
