// Renderer-side helper that turns an array of menu descriptors into a
// serializable template, ships them to the main process to popup an Electron
// menu, and dispatches click events back to per-item click handlers.

import type { MenuTemplate, MenuTemplateItem, MenuPopupPosition } from '@shared/types/menu'

// Renderer-side click handler. Receives the optional payload supplied when the
// popup was opened (e.g. a tab id).
export type MenuClickHandler = (payload: unknown) => void

export interface ContextMenuItem {
  id?: string
  label?: string
  // Loose `string` here lets the menu factories emit plain `'separator'`
  // literals without `as const`. The serializer only special-cases 'separator'.
  type?: string
  accelerator?: string
  enabled?: boolean
  checked?: boolean
  submenu?: ContextMenuItem[]
  click?: (...args: unknown[]) => void
}

let nextId = 1
const nextItemId = (): string => `mi-${nextId++}`

const serialize = (
  items: Array<ContextMenuItem | null | undefined>,
  handlers: Map<string, MenuClickHandler | undefined>
): MenuTemplate => {
  const out: MenuTemplateItem[] = []
  for (const item of items) {
    if (!item) continue
    if (item.type === 'separator') {
      out.push({ type: 'separator' })
      continue
    }
    const id = item.id ? `${item.id}-${nextItemId()}` : nextItemId()
    handlers.set(id, item.click as MenuClickHandler | undefined)
    out.push({
      id,
      label: item.label,
      type: item.type as MenuTemplateItem['type'],
      accelerator: item.accelerator,
      enabled: item.enabled !== false,
      checked: !!item.checked,
      submenu: item.submenu ? serialize(item.submenu, handlers) : undefined
    })
  }
  return out
}

export const popupContextMenu = (
  items: Array<ContextMenuItem | null | undefined>,
  position: MenuPopupPosition,
  payload: unknown = {}
): void => {
  const handlers = new Map<string, MenuClickHandler | undefined>()
  const template = serialize(items, handlers)

  let offClick: (() => void) | null = null
  let offClosed: (() => void) | null = null

  const cleanup = (): void => {
    if (offClick) {
      offClick()
      offClick = null
    }
    if (offClosed) {
      offClosed()
      offClosed = null
    }
    handlers.clear()
  }

  offClick = window.electron.ipcRenderer.on('mt::menu::click', (_e, message) => {
    // Main process actually sends `{ windowId, id }` (see src/main/ipc/window.ts);
    // the contract `[menuId: string]` is intentionally narrowed at the boundary.
    const id = (message as unknown as { id?: string } | undefined)?.id ?? ''
    const handler = handlers.get(id)
    if (typeof handler === 'function') {
      try {
        handler(payload)
      } catch (err) {
        console.error(err)
      }
    }
  })
  offClosed = window.electron.ipcRenderer.on('mt::menu::closed', () => cleanup())

  window.electron.windowControl.popupMenu(template, position)
}
