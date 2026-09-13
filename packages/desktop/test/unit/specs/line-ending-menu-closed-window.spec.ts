import { describe, it, expect, vi, beforeEach } from 'vitest'

// A renderer can queue `mt::update-line-ending-menu` (e.g. from a tab switch)
// in the moment between sending `mt::close-window` and main destroying the
// window. Main removes the window menu first, so the late message must be
// ignored instead of throwing "Cannot find window menu for id N" (#4923).

const { ipcOn, crlfItem, lfItem } = vi.hoisted(() => ({
  ipcOn: vi.fn(),
  crlfItem: { checked: false },
  lfItem: { checked: false }
}))

vi.mock('electron', () => ({
  app: { addRecentDocument: vi.fn(), clearRecentDocuments: vi.fn() },
  ipcMain: { on: ipcOn, handle: vi.fn(), emit: vi.fn() },
  Menu: {
    buildFromTemplate: vi.fn(() => ({
      getMenuItemById: (id: string) =>
        id === 'crlfLineEndingMenuEntry' ? crlfItem : id === 'lfLineEndingMenuEntry' ? lfItem : null
    })),
    setApplicationMenu: vi.fn(),
    getApplicationMenu: vi.fn()
  }
}))

vi.mock('common/filesystem', () => ({
  ensureDirSync: vi.fn(),
  isDirectory2: () => false,
  isFile2: () => false
}))

vi.mock('main_renderer/config', () => ({ isLinux: false, isOsx: true, isWindows: false }))
vi.mock('main_renderer/menu/actions/edit', () => ({ updateSidebarMenu: vi.fn() }))
vi.mock('main_renderer/menu/actions/format', () => ({ updateFormatMenu: vi.fn() }))
vi.mock('main_renderer/menu/actions/paragraph', () => ({ updateSelectionMenus: vi.fn() }))
vi.mock('main_renderer/menu/actions/view', () => ({ viewLayoutChanged: vi.fn() }))
vi.mock('main_renderer/utils/internalIpc', () => ({ onInternalChannel: vi.fn() }))
vi.mock('main_renderer/i18n.js', () => ({ setLanguage: vi.fn() }))
vi.mock('main_renderer/menu/templates', () => ({
  default: vi.fn(() => []),
  configSettingMenu: vi.fn(() => [])
}))

import AppMenu from 'main_renderer/menu'
import type Preference from 'main_renderer/preferences'
import type Keybindings from 'main_renderer/keyboard/shortcutHandler'

type LineEndingListener = (event: unknown, windowId: number, lineEnding: string) => void

const setup = () => {
  ipcOn.mockClear()
  const preferences = { getItem: () => 'en' } as unknown as Preference
  const keybindings = { registerEditorKeyHandlers: vi.fn() } as unknown as Keybindings
  const appMenu = new AppMenu(preferences, keybindings, '/tmp/mt-test')
  const call = ipcOn.mock.calls.find(([channel]) => channel === 'mt::update-line-ending-menu')
  if (!call) throw new Error('mt::update-line-ending-menu listener was not registered')
  return { appMenu, onLineEnding: call[1] as LineEndingListener }
}

describe('mt::update-line-ending-menu (#4923)', () => {
  beforeEach(() => {
    crlfItem.checked = false
    lfItem.checked = false
  })

  it('checks the line ending of a window that still has its menu', () => {
    const { appMenu, onLineEnding } = setup()
    appMenu.addEditorMenu({ id: 1 } as never)

    onLineEnding({}, 1, 'crlf')

    expect(crlfItem.checked).toBe(true)
  })

  it('ignores a late update for a window whose menu was already removed', () => {
    const { appMenu, onLineEnding } = setup()
    appMenu.addEditorMenu({ id: 1 } as never)
    appMenu.removeWindowMenu(1)

    expect(() => onLineEnding({}, 1, 'crlf')).not.toThrow()
    expect(crlfItem.checked).toBe(false)
  })
})
