import { describe, expect, it } from 'vitest'
import { isRenameShortcut, renameSelectionEnd, shouldRenameSelection } from '@/components/sideBar/renameKey'

const file = { pathname: '/docs/notes.md', isFile: true, isDirectory: false }
const folder = { pathname: '/docs/sub', isFile: false, isDirectory: true }

const base = {
  key: 'F2',
  selection: file,
  projectRootPath: '/docs',
  pathSeparator: '/',
  isEditingName: false,
  editableTarget: false,
  allowEditableTarget: false
}

describe('sidebar rename keyboard rules', () => {
  it('accepts F2 and Enter only', () => {
    expect(isRenameShortcut('F2')).toBe(true)
    expect(isRenameShortcut('Enter')).toBe(true)
    expect(isRenameShortcut('Delete')).toBe(false)
    expect(isRenameShortcut('f2')).toBe(false)
  })

  it('renames a selected file or folder, but never the project root', () => {
    expect(shouldRenameSelection(base)).toBe(true)
    expect(shouldRenameSelection({ ...base, key: 'Enter' })).toBe(true)
    expect(shouldRenameSelection({ ...base, selection: folder })).toBe(true)
    expect(
      shouldRenameSelection({ ...base, selection: { pathname: '/docs', isDirectory: true } })
    ).toBe(false)
  })

  it('rejects empty, untyped, or out-of-project selections', () => {
    expect(shouldRenameSelection({ ...base, selection: null })).toBe(false)
    expect(shouldRenameSelection({ ...base, selection: {} })).toBe(false)
    expect(shouldRenameSelection({ ...base, selection: { pathname: '/docs/a' } })).toBe(false)
    expect(
      shouldRenameSelection({
        ...base,
        projectRootPath: '/project-b',
        selection: { pathname: '/project-a/notes.md', isFile: true }
      })
    ).toBe(false)
  })

  it('does not fire while a name input is already open', () => {
    expect(shouldRenameSelection({ ...base, isEditingName: true })).toBe(false)
  })

  it('defers to editable surfaces unless the key is free there', () => {
    expect(shouldRenameSelection({ ...base, editableTarget: true })).toBe(false)
    expect(shouldRenameSelection({ ...base, key: 'Enter', editableTarget: true })).toBe(false)
    // The WYSIWYG editor allows F2 through (no editor meaning) but keeps Enter.
    expect(
      shouldRenameSelection({
        ...base,
        editableTarget: true,
        allowEditableTarget: true
      })
    ).toBe(true)
    expect(
      shouldRenameSelection({
        ...base,
        key: 'Enter',
        editableTarget: true,
        allowEditableTarget: true
      })
    ).toBe(true)
  })

  it('preselects the file stem but keeps dotfiles whole', () => {
    expect(renameSelectionEnd('notes.md')).toBe(5)
    expect(renameSelectionEnd('archive.tar.gz')).toBe(11)
    expect(renameSelectionEnd('README')).toBe(6)
    expect(renameSelectionEnd('.gitignore')).toBe(10)
    expect(renameSelectionEnd('trailing.')).toBe(9)
  })
})
