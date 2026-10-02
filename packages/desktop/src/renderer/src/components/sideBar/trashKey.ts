// Keyboard rules for trashing the sidebar selection.
//
// The editor is a `contenteditable` in the same document as the sidebar, so a
// plain global Delete listener would fight the editor for keystrokes. These
// helpers keep the shortcut explorer-shaped: `Delete` everywhere, plus
// `Cmd+Backspace` on macOS (where the key labelled "delete" reports as
// Backspace, while forward-delete reports as Delete). A bare Backspace never
// trashes anything.

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
  // Whether the keystroke landed on an editable surface, and whether that
  // surface is the WYSIWYG editor specifically.
  editableTarget: boolean
  allowEditableTarget: boolean
}

export const isEditableTarget = (target: EventTarget | null): boolean => {
  const el = target as { tagName?: unknown; isContentEditable?: unknown } | null
  if (!el || typeof el !== 'object') return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable === true
}

// The WYSIWYG engine's contenteditable root (`CLASS_NAMES.MU_EDITOR`). Opening a
// file from the sidebar autofocuses it, so the trash shortcut must still fire
// there; other editable surfaces (search, rename, command palette) keep Delete.
export const isMuyaEditorTarget = (target: EventTarget | null): boolean => {
  const el = target as { closest?: (selector: string) => unknown } | null
  if (!el || typeof el.closest !== 'function') return false
  return !!el.closest('.mu-editor')
}

// A chord arrives as one keydown per key, so holding Cmd before Backspace fires
// a `Meta` keydown first. That press is part of the shortcut, not typing.
const MODIFIER_KEYS = new Set(['Meta', 'Shift', 'Control', 'Alt', 'CapsLock'])

export const isModifierKey = (key: string): boolean => MODIFIER_KEYS.has(key)

// A tree row owns the selection; the pending new-file input belongs to the row
// that spawned it. Everywhere else — editor, sidebar chrome, other inputs —
// ends the selection.
const SELECTION_OWNERS = '.side-bar-file, .side-bar-folder, .new-input'

export const keepsSidebarSelection = (target: EventTarget | null): boolean => {
  const el = target as { closest?: (selector: string) => unknown } | null
  if (!el || typeof el.closest !== 'function') return false
  return !!el.closest(SELECTION_OWNERS)
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
    editableTarget,
    allowEditableTarget
  } = context
  if (!isTrashShortcut(key, metaKey, isMac)) return false
  if (editableTarget && !allowEditableTarget) return false
  if (isEditingName) return false
  if (!selection || typeof selection.pathname !== 'string' || selection.pathname === '') return false
  // A selection that is not inside the current project is stale — e.g. the tree
  // was swapped for another folder without a click to clear the selection.
  if (!isPathWithinRoot(selection.pathname, projectRootPath, pathSeparator)) return false
  // The project root is a tree node too; a keystroke must not trash the whole
  // folder. Deleting it stays an explicit context-menu action.
  if (selection.pathname === projectRootPath) return false
  return selection.isFile === true || selection.isDirectory === true
}
