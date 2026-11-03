import type { Menu, MenuItem } from 'electron'

// App-owned templates must provide these entries; missing IDs indicate a template/handler mismatch.
export const requireMenuItem = (menu: Menu, id: string): MenuItem => {
  const item = menu.getMenuItemById(id)
  if (!item) throw new Error(`Required menu item is missing: ${id}`)
  return item
}

export const requireSubmenu = (menu: Menu, id: string): Menu => {
  const item = requireMenuItem(menu, id)
  if (!item.submenu) throw new Error(`Required submenu is missing: ${id}`)
  return item.submenu
}
