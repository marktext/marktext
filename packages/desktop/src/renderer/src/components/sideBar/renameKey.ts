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
  if (!isPathWithinRoot(selection.pathname, projectRootPath, pathSeparator)) return false
  if (selection.pathname === projectRootPath) return false
  return selection.isFile === true || selection.isDirectory === true
}

// Preselect the file stem; names without a real extension select whole.
export const renameSelectionEnd = (name: string): number => {
  const dot = name.lastIndexOf('.')
  if (dot <= 0 || dot === name.length - 1) return name.length
  return dot
}
