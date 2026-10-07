// Keyboard rules for renaming the sidebar selection (#1618). F2 is the VS Code
// explorer accelerator; Enter is the Finder / Windows Explorer gesture. Both
// open the same inline input the context menu already uses.

import { isPathWithinRoot } from './trashKey'

export interface RenameSelection {
  pathname?: unknown
  isFile?: unknown
  isDirectory?: unknown
}

export interface RenameKeyContext {
  key: string
  selection: RenameSelection | null | undefined
  projectRootPath?: string
  pathSeparator: string
  isEditingName: boolean
  // Rename and the new-file input live inside the tree, so their keydown
  // bubbles back here; typing a name must not re-open the rename box.
  editableTarget: boolean
}

export const isRenameShortcut = (key: string): boolean => key === 'F2' || key === 'Enter'

export const shouldRenameSelection = (context: RenameKeyContext): boolean => {
  const {
    key,
    selection,
    projectRootPath,
    pathSeparator,
    isEditingName,
    editableTarget
  } = context
  if (!isRenameShortcut(key)) return false
  if (editableTarget) return false
  if (isEditingName) return false
  if (!selection || typeof selection.pathname !== 'string' || selection.pathname === '') return false
  // A selection outside the current project is stale: the tree was swapped
  // without a click to clear it.
  if (!isPathWithinRoot(selection.pathname, projectRootPath, pathSeparator)) return false
  // The root has no inline rename input, so the gesture would leave the tree
  // stuck in "editing" with nothing to edit.
  if (selection.pathname === projectRootPath) return false
  return selection.isFile === true || selection.isDirectory === true
}

// Where the inline-rename selection should end. The explorer preselects the
// file stem so typing replaces the name while the extension survives; names
// without a real extension (dotfiles such as `.gitignore`, or a trailing dot)
// are selected whole.
export const renameSelectionEnd = (name: string): number => {
  const dot = name.lastIndexOf('.')
  if (dot <= 0 || dot === name.length - 1) return name.length
  return dot
}
