// Keyboard rules for trashing the sidebar selection. `Delete` fires on every
// platform; macOS also accepts `Cmd+Backspace`, where the key labelled "delete"
// reports as Backspace. A bare Backspace never trashes.

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
  editableTarget: boolean
}

export const isEditableTarget = (target: EventTarget | null): boolean => {
  const el = target as { tagName?: unknown; isContentEditable?: unknown } | null
  if (!el || typeof el !== 'object') return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable === true
}

// Tree rows own the selection; the new-file input belongs to the row that spawned it.
const SELECTION_OWNERS = '.side-bar-file, .side-bar-folder, .new-input'

export const keepsSidebarSelection = (target: EventTarget | null): boolean => {
  if (!target) return false
  return !!(target as Element)?.closest?.(SELECTION_OWNERS)
}

export const isInsideTreeScope = (target: EventTarget | null): boolean => {
  if (!target) return false
  return !!(target as Element)?.closest?.('.tree-wrapper')
}

// Clicks inside these must not drop their own target, or the input unmounts mid-edit.
const NAME_INPUTS = 'input.rename, input.new-input'

export const isNameInput = (target: EventTarget | null): boolean => {
  if (!target) return false
  return !!(target as Element)?.closest?.(NAME_INPUTS)
}

export const isTrashShortcut = (key: string, metaKey: boolean, isMac: boolean): boolean => {
  if (key === 'Delete') return true
  return isMac && metaKey && key === 'Backspace'
}

// Watcher/editor paths can use the OS separator while roots built with
// `window.path` use `/` (#5683), so fold both to one separator before comparing.
const toSlash = (value: string): string => value.replace(/[\\/]+/g, '/')

export const isPathWithinRoot = (
  pathname: string,
  rootPath: string | undefined,
  separator: string
): boolean => {
  if (!rootPath) return false
  const target = toSlash(pathname)
  const root = toSlash(rootPath)
  if (target === root) return true
  const sep = toSlash(separator) || '/'
  const prefix = root.endsWith(sep) ? root : root + sep
  return target.startsWith(prefix)
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
