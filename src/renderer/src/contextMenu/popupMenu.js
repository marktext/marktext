// Renderer-side helper that turns an array of menu descriptors into a
// serializable template, ships them to the main process to popup an Electron
// menu, and dispatches click events back to per-item click handlers.

let nextId = 1
const nextItemId = () => `mi-${nextId++}`

const serialize = (items, handlers) => {
  const out = []
  for (const item of items) {
    if (!item) continue
    if (item.type === 'separator') {
      out.push({ type: 'separator' })
      continue
    }
    const id = item.id ? `${item.id}-${nextItemId()}` : nextItemId()
    handlers.set(id, item.click)
    out.push({
      id,
      label: item.label,
      type: item.type,
      accelerator: item.accelerator,
      enabled: item.enabled !== false,
      checked: !!item.checked,
      submenu: item.submenu ? serialize(item.submenu, handlers) : undefined
    })
  }
  return out
}

export const popupContextMenu = (items, position, payload = {}) => {
  const handlers = new Map()
  const template = serialize(items, handlers)

  let offClick = null
  let offClosed = null

  const cleanup = () => {
    if (offClick) { offClick(); offClick = null }
    if (offClosed) { offClosed(); offClosed = null }
    handlers.clear()
  }

  offClick = window.electron.ipcRenderer.on('mt::menu::click', (_e, message) => {
    const handler = handlers.get(message?.id)
    if (typeof handler === 'function') {
      try { handler(payload) } catch (err) { console.error(err) }
    }
  })
  offClosed = window.electron.ipcRenderer.on('mt::menu::closed', () => cleanup())

  window.electron.windowControl.popupMenu(template, position)
}
