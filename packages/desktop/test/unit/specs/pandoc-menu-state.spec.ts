import { describe, it, expect, vi, afterEach } from 'vitest'

// Main-process slice: the "Convert with Pandoc" submenu exports the active tab,
// so a window with no document open must not offer it — the click would reach a
// renderer with no editor mounted and silently do nothing (#5379). The renderer
// owns the tab list, reports the state over `mt::update-pandoc-menu`, and main
// has to re-apply it after every menu rebuild, because menus are rebuilt from
// the template on preference changes.

const { ipcOn, createdMenus, buildFromTemplate } = vi.hoisted(() => {
  interface FakeMenuItem {
    enabled: boolean
  }

  const createdMenus: { pandocItem: FakeMenuItem; importItem: FakeMenuItem }[] = []
  const buildFromTemplate = vi.fn(() => {
    const pandocItem: FakeMenuItem = { enabled: true }
    const importItem: FakeMenuItem = { enabled: true }
    createdMenus.push({ pandocItem, importItem })
    return {
      getMenuItemById: (id: string) => {
        if (id === 'convertWithPandocMenuItem') return pandocItem
        if (id === 'importFileMenuItem') return importItem
        return null
      }
    }
  })

  return { ipcOn: vi.fn(), createdMenus, buildFromTemplate }
})

vi.mock('electron', () => ({
  app: { addRecentDocument: vi.fn(), clearRecentDocuments: vi.fn() },
  ipcMain: { on: ipcOn, handle: vi.fn(), emit: vi.fn() },
  Menu: { buildFromTemplate, setApplicationMenu: vi.fn(), getApplicationMenu: vi.fn() }
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
import {
  setPandocAvailable,
  setPandocAvailabilityListener
} from 'main_renderer/app/pandocAvailability'
import type Preference from 'main_renderer/preferences'
import type Keybindings from 'main_renderer/keyboard/shortcutHandler'

type PandocListener = (event: unknown, windowId: number, hasDocument: boolean) => void

const lastPandocItem = () => createdMenus[createdMenus.length - 1]?.pandocItem
const lastImportItem = () => createdMenus[createdMenus.length - 1]?.importItem

const setup = () => {
  ipcOn.mockClear()
  createdMenus.length = 0

  const preferences = { getItem: () => 'en' } as unknown as Preference
  const keybindings = { registerEditorKeyHandlers: vi.fn() } as unknown as Keybindings
  const appMenu = new AppMenu(preferences, keybindings, '/tmp/mt-test')

  const call = ipcOn.mock.calls.find(([channel]) => channel === 'mt::update-pandoc-menu')
  if (!call) throw new Error('mt::update-pandoc-menu listener was not registered')

  return { appMenu, onPandoc: call[1] as PandocListener }
}

describe('mt::update-pandoc-menu (#5379)', () => {
  it('greys the export out while the window has no document', () => {
    const { appMenu, onPandoc } = setup()
    appMenu.addEditorMenu({ id: 1 } as never)

    onPandoc({}, 1, false)

    expect(lastPandocItem()?.enabled).toBe(false)
  })

  it('enables it again once a document is open', () => {
    const { appMenu, onPandoc } = setup()
    appMenu.addEditorMenu({ id: 1 } as never)

    onPandoc({}, 1, false)
    onPandoc({}, 1, true)

    expect(lastPandocItem()?.enabled).toBe(true)
  })

  it('tracks each window separately', () => {
    const { appMenu, onPandoc } = setup()
    appMenu.addEditorMenu({ id: 1 } as never)
    appMenu.addEditorMenu({ id: 2 } as never)

    onPandoc({}, 1, false)

    const [first, second] = createdMenus
    expect(first?.pandocItem.enabled).toBe(false)
    expect(second?.pandocItem.enabled).toBe(true)
  })

  it('re-applies the state after a menu rebuild', () => {
    const { appMenu, onPandoc } = setup()
    appMenu.addEditorMenu({ id: 1 } as never)
    onPandoc({}, 1, false)

    appMenu.updateAppMenu()

    // The rebuilt entry starts out enabled again, so it has to be greyed anew.
    expect(createdMenus).toHaveLength(2)
    expect(lastPandocItem()?.enabled).toBe(false)
  })

  it('leaves the export enabled for a window that never reported', () => {
    const { appMenu } = setup()

    appMenu.addEditorMenu({ id: 1 } as never)

    expect(lastPandocItem()?.enabled).toBe(true)
  })

  it('ignores a late update for a window whose menu was already removed', () => {
    const { appMenu, onPandoc } = setup()
    appMenu.addEditorMenu({ id: 1 } as never)
    appMenu.removeWindowMenu(1)

    expect(() => onPandoc({}, 1, false)).not.toThrow()
  })
})

// There is no "enable pandoc" preference any more: the two entries are offered
// exactly when the binary is there. `main/index.ts` wires the listener so a
// changed answer rebuilds the menus.
describe('pandoc availability (#5379)', () => {
  // The check result lives in module scope, so put it back for the tests above.
  afterEach(() => setPandocAvailable(true))

  it('greys both pandoc entries out when pandoc is not detected', () => {
    const { appMenu } = setup()
    setPandocAvailabilityListener(() => appMenu.updateAppMenu())
    appMenu.addEditorMenu({ id: 1 } as never)

    setPandocAvailable(false)

    expect(lastPandocItem()?.enabled).toBe(false)
    expect(lastImportItem()?.enabled).toBe(false)
  })

  it('keeps import enabled without a document, because it opens one', () => {
    const { appMenu, onPandoc } = setup()
    appMenu.addEditorMenu({ id: 1 } as never)

    onPandoc({}, 1, false)

    expect(lastPandocItem()?.enabled).toBe(false)
    expect(lastImportItem()?.enabled).toBe(true)
  })
})
