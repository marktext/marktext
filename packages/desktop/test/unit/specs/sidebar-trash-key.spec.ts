import { describe, expect, it } from 'vitest'
import {
  isModifierKey,
  isNameInput,
  isPathWithinRoot,
  isTrashShortcut,
  keepsSidebarSelection,
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
  pathSeparator: '/',
  isEditingName: false,
  editableTarget: false,
  allowEditableTarget: false
}

describe('sidebar trash keyboard rules', () => {
  it('accepts Delete everywhere and Cmd+Backspace on macOS only', () => {
    expect(isTrashShortcut('Delete', false, false)).toBe(true)
    expect(isTrashShortcut('Delete', false, true)).toBe(true)
    expect(isTrashShortcut('Backspace', true, true)).toBe(true)
    expect(isTrashShortcut('Backspace', true, false)).toBe(false)
    expect(isTrashShortcut('Backspace', false, true)).toBe(false)
    expect(isTrashShortcut('Backspace', false, false)).toBe(false)
  })

  it('does not treat the Meta keydown of a chord as typing', () => {
    expect(isModifierKey('Meta')).toBe(true)
    expect(isModifierKey('Control')).toBe(true)
    expect(isModifierKey('Backspace')).toBe(false)
    expect(isModifierKey('a')).toBe(false)
  })

  it('keeps the selection on tree rows and the new-file input only', () => {
    const owner = (token: string) =>
      ({
        closest: (selector: string) => (selector.includes(token) ? {} : null)
      }) as unknown as EventTarget
    expect(keepsSidebarSelection(owner('.side-bar-file'))).toBe(true)
    expect(keepsSidebarSelection(owner('.side-bar-folder'))).toBe(true)
    expect(keepsSidebarSelection(owner('.new-input'))).toBe(true)
    expect(keepsSidebarSelection({ closest: () => null } as unknown as EventTarget)).toBe(false)
  })

  it('leaves clicks inside the inline rename / new-file boxes alone', () => {
    const input = (token: string) =>
      ({
        closest: (selector: string) => (selector.includes(token) ? {} : null)
      }) as unknown as EventTarget
    expect(isNameInput(input('input.rename'))).toBe(true)
    expect(isNameInput(input('input.new-input'))).toBe(true)
    expect(isNameInput({ closest: () => null } as unknown as EventTarget)).toBe(false)
  })

  it('trashes a selected file or folder, but never the project root', () => {
    expect(shouldTrashSelection(base)).toBe(true)
    expect(shouldTrashSelection({ ...base, selection: folder })).toBe(true)
    expect(
      shouldTrashSelection({ ...base, selection: { pathname: '/docs', isDirectory: true } })
    ).toBe(false)
  })

  it('rejects selections outside the current project', () => {
    expect(isPathWithinRoot('/docs/sub/a.md', '/docs', '/')).toBe(true)
    expect(isPathWithinRoot('/docs', '/docs', '/')).toBe(true)
    expect(isPathWithinRoot('/docs2/a.md', '/docs', '/')).toBe(false)
    expect(isPathWithinRoot('/docs/a.md', undefined, '/')).toBe(false)
    expect(
      shouldTrashSelection({
        ...base,
        projectRootPath: '/project-b',
        selection: { pathname: '/project-a/notes.md', isFile: true }
      })
    ).toBe(false)
  })

  it('ignores empty or unknown selections', () => {
    expect(shouldTrashSelection({ ...base, selection: null })).toBe(false)
    expect(shouldTrashSelection({ ...base, selection: {} })).toBe(false)
    expect(shouldTrashSelection({ ...base, selection: { pathname: '/docs/a' } })).toBe(false)
  })

  it('defers to editable surfaces, except the WYSIWYG editor', () => {
    expect(shouldTrashSelection({ ...base, editableTarget: true })).toBe(false)
    expect(shouldTrashSelection({ ...base, editableTarget: true, allowEditableTarget: true })).toBe(
      true
    )
  })

  it('does not fire while renaming or creating', () => {
    expect(shouldTrashSelection({ ...base, isEditingName: true })).toBe(false)
  })
})
