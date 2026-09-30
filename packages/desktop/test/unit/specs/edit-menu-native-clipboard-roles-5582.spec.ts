import { describe, expect, it, vi } from 'vitest'

// #5582: On macOS, Cmd+V did not paste into editable controls of native
// Open/Save panels (e.g. the "Go to Folder" sheet). The Edit menu bound Paste
// to a custom `click` handler that called `webContents.paste()` on the focused
// MarkText window. While a native panel owns focus there is no focused
// webContents, so the shortcut became a no-op instead of reaching the panel's
// first responder.
//
// The fix is to use Electron's native `role: 'cut' | 'copy' | 'paste'` menu
// items. Electron's macOS menu controller maps those roles to the native
// selectors `cut:`/`copy:`/`paste:` with a `nil` target, so the action travels
// down the responder chain and reaches the panel. A custom `click` handler is
// what regressed that behavior, so assert it is gone.

vi.mock('electron', () => ({}))
vi.mock('main_renderer/menu/actions/edit', () => ({}))
vi.mock('main_renderer/i18n', () => ({ t: (key: string) => key }))
vi.mock('main_renderer/commands', () => ({
  COMMANDS: new Proxy(
    {},
    {
      // `EDIT_CUT` -> `edit.cut` so assertions can use the real command ids.
      get: (_target, prop: string | symbol) => String(prop).toLowerCase().replace('_', '.')
    }
  )
}))

const keybindings = {
  getAccelerator: (id: string) => `accel:${id}`
} as never

interface ClipboardItem {
  label?: string
  role?: string
  accelerator?: string
  click?: unknown
}

async function buildEditSubmenu(isOsx: boolean): Promise<ClipboardItem[]> {
  vi.resetModules()
  vi.doMock('main_renderer/config', () => ({ isOsx }))
  const mod = await import('main_renderer/menu/templates/edit')
  return mod.default(keybindings).submenu as ClipboardItem[]
}

const clipboardItem = (submenu: ClipboardItem[], role: string): ClipboardItem | undefined =>
  submenu.find((item) => item.role === role)

describe('Edit menu uses native clipboard roles (#5582)', () => {
  for (const isOsx of [true, false]) {
    const platform = isOsx ? 'macOS' : 'Windows/Linux'

    it(`binds Cut/Copy/Paste to native roles on ${platform}`, async() => {
      const submenu = await buildEditSubmenu(isOsx)

      expect(clipboardItem(submenu, 'cut')).toBeTruthy()
      expect(clipboardItem(submenu, 'copy')).toBeTruthy()
      expect(clipboardItem(submenu, 'paste')).toBeTruthy()
    })

    it(`does not swallow the clipboard shortcuts with a custom click handler on ${platform}`, async() => {
      const submenu = await buildEditSubmenu(isOsx)

      for (const role of ['cut', 'copy', 'paste']) {
        const item = clipboardItem(submenu, role)
        expect(item).toBeDefined()
        // A custom `click` makes Electron call it instead of forwarding the
        // native action to the first responder, which is the #5582 regression.
        expect(item?.click).toBeUndefined()
      }
    })
  }

  it('keeps the user-configured accelerators on the native role items', async() => {
    const submenu = await buildEditSubmenu(true)

    expect(clipboardItem(submenu, 'cut')?.accelerator).toBe('accel:edit.cut')
    expect(clipboardItem(submenu, 'copy')?.accelerator).toBe('accel:edit.copy')
    expect(clipboardItem(submenu, 'paste')?.accelerator).toBe('accel:edit.paste')
  })
})
