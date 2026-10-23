import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { buildFromTemplate, setApplicationMenu, configureMenu, configSettingMenu } = vi.hoisted(
  () => ({
    buildFromTemplate: vi.fn(() => ({
      getMenuItemById: () => ({ checked: false, enabled: true })
    })),
    setApplicationMenu: vi.fn(),
    configureMenu: vi.fn(() => ({ menu: null, type: 0 })),
    configSettingMenu: vi.fn(() => ({ menu: null, type: 2 }))
  })
)

vi.mock('electron', () => ({
  app: { addRecentDocument: vi.fn(), clearRecentDocuments: vi.fn() },
  ipcMain: { on: vi.fn(), handle: vi.fn(), emit: vi.fn() },
  Menu: { buildFromTemplate, setApplicationMenu, getApplicationMenu: vi.fn() }
}))

vi.mock('main_renderer/config', () => ({ isLinux: false, isOsx: true, isWindows: false }))
vi.mock('main_renderer/menu/actions/edit', () => ({ updateSidebarMenu: vi.fn() }))
vi.mock('main_renderer/menu/actions/format', () => ({ updateFormatMenu: vi.fn() }))
vi.mock('main_renderer/menu/actions/paragraph', () => ({ updateSelectionMenus: vi.fn() }))
vi.mock('main_renderer/menu/actions/view', () => ({ viewLayoutChanged: vi.fn() }))
vi.mock('main_renderer/utils/internalIpc', () => ({ onInternalChannel: vi.fn() }))
vi.mock('main_renderer/i18n.js', () => ({ setLanguage: vi.fn() }))
vi.mock('main_renderer/menu/templates', () => ({
  default: configureMenu,
  configSettingMenu
}))

import AppMenu from 'main_renderer/menu'

describe('AppMenu recently used documents', () => {
  let tempDir: string

  const makeAppMenu = (): AppMenu =>
    new AppMenu(
      { getItem: () => 'en' } as never,
      { registerEditorKeyHandlers: vi.fn() } as never,
      tempDir
    )

  const makeFile = (name: string): string => {
    const filePath = path.join(tempDir, name)
    fs.writeFileSync(filePath, '')
    return filePath
  }

  const readStorage = (): string[] =>
    JSON.parse(fs.readFileSync(path.join(tempDir, 'recently-used-documents.json'), 'utf-8'))

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-recent-menu-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('persists recently used documents on macOS', () => {
    const appMenu = makeAppMenu()
    const file = makeFile('note.md')

    appMenu.addRecentlyUsedDocument(file)

    expect(readStorage()).toEqual([file])
  })

  it('keeps the full history instead of trimming it to twelve entries', () => {
    const appMenu = makeAppMenu()
    const files = Array.from({ length: 15 }, (_, i) => makeFile(`note-${i}.md`))

    files.forEach((file) => appMenu.addRecentlyUsedDocument(file))

    expect(readStorage()).toHaveLength(15)
  })

  it('removes a single entry', () => {
    const appMenu = makeAppMenu()
    const [a, b, c] = ['a.md', 'b.md', 'c.md'].map(makeFile)
    appMenu.addRecentlyUsedDocument(a)
    appMenu.addRecentlyUsedDocument(b)
    appMenu.addRecentlyUsedDocument(c)

    appMenu.removeRecentlyUsedDocument(b)

    expect(readStorage()).toEqual([c, a])
  })
})
