import { describe, expect, it } from 'vitest'
import {
  isEditableTarget,
  isMuyaEditorTarget,
  isTrashShortcut,
  shouldTrashSelection
} from '@/components/sideBar/trashKey'

const file = { pathname: '/docs/notes.md', isFile: true, isDirectory: false }
const folder = { pathname: '/docs/sub', isFile: false, isDirectory: true }

const base = {
  key: 'Delete',
  metaKey: false,
  isMac: false,
  selection: file,
  projectRootPath: '/docs',
  isEditingName: false,
  editableTarget: false,
  allowEditableTarget: false
}

describe('sidebar trash keyboard rules', () => {
  it('accepts Delete on every platform', () => {
    expect(isTrashShortcut('Delete', false, false)).toBe(true)
    expect(isTrashShortcut('Delete', false, true)).toBe(true)
  })

  it('accepts Cmd+Backspace on macOS only', () => {
    expect(isTrashShortcut('Backspace', true, true)).toBe(true)
    expect(isTrashShortcut('Backspace', true, false)).toBe(false)
  })

  it('rejects a bare Backspace everywhere', () => {
    expect(isTrashShortcut('Backspace', false, true)).toBe(false)
    expect(isTrashShortcut('Backspace', false, false)).toBe(false)
  })

  it('detects editable targets', () => {
    expect(isEditableTarget(null)).toBe(false)
    expect(isEditableTarget({ tagName: 'DIV' } as unknown as EventTarget)).toBe(false)
    expect(isEditableTarget({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(true)
    expect(isEditableTarget({ tagName: 'TEXTAREA' } as unknown as EventTarget)).toBe(true)
    expect(isEditableTarget({ isContentEditable: true } as unknown as EventTarget)).toBe(true)
  })

  it('recognises the WYSIWYG editor contenteditable', () => {
    const inside = { closest: (selector: string) => (selector === '.mu-editor' ? {} : null) }
    const outside = { closest: () => null }
    expect(isMuyaEditorTarget(null)).toBe(false)
    expect(isMuyaEditorTarget(inside as unknown as EventTarget)).toBe(true)
    expect(isMuyaEditorTarget(outside as unknown as EventTarget)).toBe(false)
  })

  it('trashes a selected file or folder', () => {
    expect(shouldTrashSelection(base)).toBe(true)
    expect(shouldTrashSelection({ ...base, selection: folder })).toBe(true)
  })

  it('never trashes the project root', () => {
    expect(shouldTrashSelection({ ...base, selection: { pathname: '/docs', isDirectory: true } })).toBe(
      false
    )
  })

  it('ignores empty selections and unknown node shapes', () => {
    expect(shouldTrashSelection({ ...base, selection: null })).toBe(false)
    expect(shouldTrashSelection({ ...base, selection: {} })).toBe(false)
    expect(shouldTrashSelection({ ...base, selection: { pathname: '/docs/a' } })).toBe(false)
  })

  it('defers Delete to editable surfaces other than the WYSIWYG editor', () => {
    expect(shouldTrashSelection({ ...base, editableTarget: true })).toBe(false)
  })

  it('still trashes when the WYSIWYG editor holds focus, since sidebar opens autofocus it', () => {
    expect(
      shouldTrashSelection({ ...base, editableTarget: true, allowEditableTarget: true })
    ).toBe(true)
  })

  it('does not fire while renaming or creating', () => {
    expect(shouldTrashSelection({ ...base, isEditingName: true })).toBe(false)
  })
})
