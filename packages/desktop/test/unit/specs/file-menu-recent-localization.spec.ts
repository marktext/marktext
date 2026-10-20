import type { MenuItemConstructorOptions } from 'electron'
import { describe, expect, it, vi } from 'vitest'

const translations = vi.hoisted(() => ({
  'menu.file.openRecent': 'Open Recent (translated)',
  'menu.file.clearRecentlyUsed': 'Clear Recently Used (translated)'
}))

vi.mock('electron', () => ({ app: { quit: vi.fn() } }))
vi.mock('main_renderer/menu/actions/file', () => ({}))
vi.mock('main_renderer/menu/actions/marktext', () => ({ userSetting: vi.fn() }))
vi.mock('main_renderer/i18n', () => ({
  t: (key: keyof typeof translations) => translations[key] ?? key
}))
vi.mock('main_renderer/utils/pandoc', () => ({ PANDOC_EXPORT_FORMATS: [] }))

const keybindings = {
  getAccelerator: () => undefined
} as never

const preferences = {
  getAll: () => ({ autoSave: false, showPandocConvert: false })
} as never

async function buildFileSubmenu(isOsx: boolean): Promise<MenuItemConstructorOptions[]> {
  vi.resetModules()
  vi.doMock('main_renderer/config', () => ({ isOsx }))
  const mod = await import('main_renderer/menu/templates/file')
  return mod.default(keybindings, preferences, []).submenu as MenuItemConstructorOptions[]
}

describe('File menu recent documents localization', () => {
  it('localizes the native macOS recent documents roles', async() => {
    const submenu = await buildFileSubmenu(true)
    const recentDocuments = submenu.find(
      (item) => (item.role as string | undefined) === 'recentdocuments'
    )

    expect(recentDocuments?.label).toBe(translations['menu.file.openRecent'])
    expect(recentDocuments?.submenu).toEqual([
      expect.objectContaining({
        role: 'clearrecentdocuments',
        label: translations['menu.file.clearRecentlyUsed']
      })
    ])
  })

  it('keeps the existing translated labels on Windows and Linux', async() => {
    const submenu = await buildFileSubmenu(false)
    const openRecent = submenu.find((item) => item.label === translations['menu.file.openRecent'])
    const childLabels = (openRecent?.submenu as MenuItemConstructorOptions[]).map(
      (item) => item.label
    )

    expect(childLabels).toContain(translations['menu.file.clearRecentlyUsed'])
  })
})
