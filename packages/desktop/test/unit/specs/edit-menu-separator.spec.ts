import { describe, expect, it, vi } from 'vitest'
import type { MenuItemConstructorOptions } from 'electron'

vi.mock('electron', () => ({}))
vi.mock('main_renderer/menu/actions/edit', () => ({}))
vi.mock('main_renderer/i18n', () => ({ t: (key: string) => key }))
vi.mock('main_renderer/commands', () => ({
  COMMANDS: new Proxy({}, { get: () => 'cmd' })
}))

const keybindings = { getAccelerator: () => undefined } as never

async function buildEditSubmenu(platform: NodeJS.Platform): Promise<MenuItemConstructorOptions[]> {
  vi.resetModules()
  vi.doMock('main_renderer/config', () => ({ isOsx: platform === 'darwin' }))
  const mod = await import('main_renderer/menu/templates/edit')
  return mod.default(keybindings).submenu as MenuItemConstructorOptions[]
}

const hasAdjacentNativeSeparators = (items: MenuItemConstructorOptions[]): boolean => {
  // Chromium's SimpleMenuModel bypasses command visibility for separators,
  // so `visible: false` alone cannot hide them on Windows/Linux (#5884).
  const visible = items.filter(i => i.type === 'separator' || i.visible !== false)
  return visible.some((item, i) =>
    item.type === 'separator' && visible[i + 1]?.type === 'separator'
  )
}

const screenshotSection = (items: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] => {
  const findInFolder = items.findIndex(i => i.label === 'menu.edit.findInFolder')
  const lineEnding = items.findIndex(i => i.label === 'menu.edit.lineEnding')
  expect(findInFolder).toBeGreaterThanOrEqual(0)
  expect(lineEnding).toBeGreaterThan(findInFolder)
  return items.slice(findInFolder + 1, lineEnding)
}

describe('Edit menu separators (#2997, #5884)', () => {
  it.each(['win32', 'linux'] as const)('has no doubled native separator on %s', async(platform) => {
    const submenu = await buildEditSubmenu(platform)
    expect(hasAdjacentNativeSeparators(submenu)).toBe(false)
    expect(screenshotSection(submenu)).toEqual([{ type: 'separator' }])
    expect(submenu.find(i => i.id === 'screenshot')).toBeUndefined()
  })

  it('keeps the screenshot entry and its separators on macOS', async() => {
    const submenu = await buildEditSubmenu('darwin')
    expect(screenshotSection(submenu)).toEqual([
      { type: 'separator' },
      expect.objectContaining({ id: 'screenshot', label: 'menu.edit.screenshot' }),
      expect.objectContaining({ type: 'separator' })
    ])
    expect(submenu.find(i => i.id === 'screenshot')?.visible).not.toBe(false)
    expect(hasAdjacentNativeSeparators(submenu)).toBe(false)
  })
})
