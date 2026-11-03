import type { Menu, MenuItem } from 'electron'
import { describe, expect, it } from 'vitest'
import { requireMenuItem, requireSubmenu } from 'main_renderer/menu/lookup'

const menuWith = (item: Partial<MenuItem> | null): Menu => ({
  getMenuItemById: () => item
}) as unknown as Menu

describe('required menu entries', () => {
  it('returns the original item so updates reach the window menu', () => {
    const item = { checked: false }
    const menu = menuWith(item)

    requireMenuItem(menu, 'sideBarMenuItem').checked = true

    expect(item.checked).toBe(true)
  })

  it('identifies the missing item in the error', () => {
    expect(() => requireMenuItem(menuWith(null), 'sideBarMenuItem'))
      .toThrow('Required menu item is missing: sideBarMenuItem')
  })

  it('returns the submenu from the supplied window menu', () => {
    const submenu = { items: [] } as unknown as Menu

    expect(requireSubmenu(menuWith({ submenu }), 'formatMenuItem')).toBe(submenu)
  })

  it('identifies an entry whose submenu is missing', () => {
    expect(() => requireSubmenu(menuWith({}), 'paragraphMenuEntry'))
      .toThrow('Required submenu is missing: paragraphMenuEntry')
  })
})
