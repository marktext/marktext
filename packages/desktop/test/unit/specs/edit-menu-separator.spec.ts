import { describe, expect, it, vi } from 'vitest'

// The Edit menu's screenshot entry is macOS-only (`visible: isOsx`). On
// Windows/Linux it was hidden but its surrounding separators stayed, leaving
// two adjacent separators (a doubled divider) between "Find in Folder" and
// "Line Ending" (#2997). Build the template per-platform and assert no two
// visible separators are adjacent.

vi.mock('electron', () => ({}))
vi.mock('main_renderer/menu/actions/edit', () => ({}))
vi.mock('main_renderer/i18n', () => ({ t: (key: string) => key }))
vi.mock('main_renderer/commands', () => ({
  COMMANDS: new Proxy({}, { get: () => 'cmd' })
}))

const keybindings = { getAccelerator: () => undefined } as never

interface Item { type?: string, visible?: boolean, id?: string }

async function buildEditSubmenu(isOsx: boolean): Promise<Item[]> {
  vi.resetModules()
  vi.doMock('main_renderer/config', () => ({ isOsx }))
  const mod = await import('main_renderer/menu/templates/edit')
  return (mod.default(keybindings).submenu as Item[])
}

const hasAdjacentVisibleSeparators = (items: Item[]): boolean => {
  const visible = items.filter(i => i.visible !== false)
  return visible.some((item, i) =>
    item.type === 'separator' && visible[i + 1]?.type === 'separator'
  )
}

describe('Edit menu separators (#2997)', () => {
  it('has no doubled separator on Windows/Linux', async() => {
    const submenu = await buildEditSubmenu(false)
    expect(submenu.find(i => i.id === 'screenshot')?.visible).toBe(false)
    expect(hasAdjacentVisibleSeparators(submenu)).toBe(false)
  })

  it('keeps the screenshot entry and its separators on macOS', async() => {
    const submenu = await buildEditSubmenu(true)
    expect(submenu.find(i => i.id === 'screenshot')?.visible).toBe(true)
    expect(hasAdjacentVisibleSeparators(submenu)).toBe(false)
  })
})
