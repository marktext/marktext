import type { MenuItemConstructorOptions } from 'electron'
import { describe, expect, it, vi } from 'vitest'

const translations = vi.hoisted(() => ({
  'menu.file.openRecent': 'Open Recent (translated)',
  'menu.file.openRecentMore': 'Search Recent (translated)',
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

async function buildFileSubmenu(
  isOsx: boolean,
  recentlyUsedFiles: string[] = []
): Promise<MenuItemConstructorOptions[]> {
  vi.resetModules()
  vi.doMock('main_renderer/config', () => ({ isOsx }))
  const mod = await import('main_renderer/menu/templates/file')
  return mod.default(keybindings, preferences, recentlyUsedFiles)
    .submenu as MenuItemConstructorOptions[]
}

const openRecentSubmenu = (submenu: MenuItemConstructorOptions[]) =>
  submenu.find((item) => item.label === translations['menu.file.openRecent'])
    ?.submenu as MenuItemConstructorOptions[]

describe('File menu recent documents', () => {
  it.each([true, false])('lists entries with search and clear actions on isOsx=%s', async(isOsx) => {
    const submenu = await buildFileSubmenu(isOsx, ['/notes/a.md'])
    const children = openRecentSubmenu(submenu)

    expect(children.map((item) => item.label ?? item.type)).toEqual([
      '/notes/a.md',
      translations['menu.file.openRecentMore'],
      'separator',
      translations['menu.file.clearRecentlyUsed']
    ])
  })

  it.each([true, false])('caps the menu on isOsx=%s while the history stays searchable', async(isOsx) => {
    const files = Array.from({ length: 20 }, (_, i) => `/notes/file-${i}.md`)
    const submenu = await buildFileSubmenu(isOsx, files)
    const recentEntries = openRecentSubmenu(submenu).filter((item) =>
      item.label?.startsWith('/notes/')
    )

    expect(recentEntries).toHaveLength(12)
  })
})
