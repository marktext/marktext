// Interaction rules for the sidebar project tree: the Delete shortcut and the
// click scope that decides when a click touches the tree's selection.
//
// `Delete` fires on every platform; macOS also accepts `Cmd+Backspace`, where
// the key labelled "delete" reports as Backspace. A bare Backspace never
// trashes.

export interface TrashSelection {
  pathname?: unknown
  isFile?: unknown
  isDirectory?: unknown
}

export interface TrashKeyContext {
  key: string
  metaKey: boolean
  isMac: boolean
  selection: TrashSelection | null | undefined
  projectRootPath?: string
  pathSeparator: string
  isEditingName: boolean
  // The inline rename / new-file inputs live inside the tree, so their keydown
  // bubbles back to the tree handler; typing in them must not trash a node.
  editableTarget: boolean
}

export const isEditableTarget = (target: EventTarget | null): boolean => {
  const el = target as { tagName?: unknown; isContentEditable?: unknown } | null
  if (!el || typeof el !== 'object') return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable === true
}

// Cmd fires a `Meta` keydown before Backspace; it is part of the chord, not typing.
const MODIFIER_KEYS = new Set(['Meta', 'Shift', 'Control', 'Alt', 'CapsLock'])

export const isModifierKey = (key: string): boolean => MODIFIER_KEYS.has(key)

// Tree rows own the selection; the new-file input belongs to the row that spawned it.
const SELECTION_OWNERS = '.side-bar-file, .side-bar-folder, .new-input'

export const keepsSidebarSelection = (target: EventTarget | null): boolean => {
  const el = target as { closest?: (selector: string) => unknown } | null
  if (!el || typeof el.closest !== 'function') return false
  return !!el.closest(SELECTION_OWNERS)
}

// The focusable project-tree container. A click inside it that misses a row
// clears the selection (VS Code's "click empty space" behaviour); a click
// outside it keeps the selection and only moves DOM focus away.
export const isInsideTreeScope = (target: EventTarget | null): boolean => {
  const el = target as { closest?: (selector: string) => unknown } | null
  if (!el || typeof el.closest !== 'function') return false
  return !!el.closest('.tree-wrapper')
}

// Clicks inside these must not drop their own target, or the input unmounts mid-edit.
const NAME_INPUTS = 'input.rename, input.new-input'

export const isNameInput = (target: EventTarget | null): boolean => {
  const el = target as { closest?: (selector: string) => unknown } | null
  if (!el || typeof el.closest !== 'function') return false
  return !!el.closest(NAME_INPUTS)
}

export const isTrashShortcut = (key: string, metaKey: boolean, isMac: boolean): boolean => {
  if (key === 'Delete') return true
  return isMac && metaKey && key === 'Backspace'
}

export const isPathWithinRoot = (
  pathname: string,
  rootPath: string | undefined,
  separator: string
): boolean => {
  if (!rootPath) return false
  if (pathname === rootPath) return true
  const prefix = rootPath.endsWith(separator) ? rootPath : rootPath + separator
  return pathname.startsWith(prefix)
}

export const shouldTrashSelection = (context: TrashKeyContext): boolean => {
  const {
    key,
    metaKey,
    isMac,
    selection,
    projectRootPath,
    pathSeparator,
    isEditingName,
    editableTarget
  } = context
  if (!isTrashShortcut(key, metaKey, isMac)) return false
  if (editableTarget) return false
  if (isEditingName) return false
  if (!selection || typeof selection.pathname !== 'string' || selection.pathname === '') return false
  // A selection outside the current project is stale: the tree was swapped
  // without a click to clear it.
  if (!isPathWithinRoot(selection.pathname, projectRootPath, pathSeparator)) return false
  // The root is a tree node too; trashing the whole project stays a context-menu action.
  if (selection.pathname === projectRootPath) return false
  return selection.isFile === true || selection.isDirectory === true
}
