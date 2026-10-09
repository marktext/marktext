import { describe, expect, it } from 'vitest'
import {
  isInsideTreeScope,
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
  editableTarget: false
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

  it('recognises clicks inside the tree focus scope', () => {
    const scope = (found: boolean) =>
      ({ closest: () => (found ? {} : null) }) as unknown as EventTarget
    expect(isInsideTreeScope(scope(true))).toBe(true)
    expect(isInsideTreeScope(scope(false))).toBe(false)
    expect(isInsideTreeScope(null)).toBe(false)
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

  it('matches roots and descendants across separator styles (#5683)', () => {
    expect(isPathWithinRoot('C:\\Users\\test\\proj\\a.md', 'C:/Users/test/proj', '/')).toBe(true)
    expect(isPathWithinRoot('C:\\Users\\test\\proj', 'C:/Users/test/proj', '/')).toBe(true)
    expect(isPathWithinRoot('C:\\Users\\other\\a.md', 'C:/Users/test/proj', '/')).toBe(false)
    // A native-separator file selection inside a posix root is still trashed.
    expect(
      shouldTrashSelection({
        ...base,
        selection: { pathname: 'C:\\Users\\test\\proj\\a.md', isFile: true },
        projectRootPath: 'C:/Users/test/proj'
      })
    ).toBe(true)
  })

  it('ignores empty or unknown selections', () => {
    expect(shouldTrashSelection({ ...base, selection: null })).toBe(false)
    expect(shouldTrashSelection({ ...base, selection: {} })).toBe(false)
    expect(shouldTrashSelection({ ...base, selection: { pathname: '/docs/a' } })).toBe(false)
  })

  it('ignores editable surfaces', () => {
    expect(shouldTrashSelection({ ...base, editableTarget: true })).toBe(false)
  })

  it('does not fire while renaming or creating', () => {
    expect(shouldTrashSelection({ ...base, isEditingName: true })).toBe(false)
  })
})
