import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { isEqualAccelerator } from 'common/keybinding'
import keybindingsWindows from 'main_renderer/keyboard/keybindingsWindows'
import keybindingsLinux from 'main_renderer/keyboard/keybindingsLinux'
import keybindingsDarwin from 'main_renderer/keyboard/keybindingsDarwin'
import Keybindings from 'main_renderer/keyboard/shortcutHandler'

const { register } = vi.hoisted(() => ({ register: vi.fn() }))

vi.mock('electron', () => ({ shell: { openPath: vi.fn() } }))
vi.mock('main_renderer/config', () => ({ isOsx: false, isLinux: false }))
vi.mock('@hfelix/electron-localshortcut', () => ({
  electronLocalshortcut: { register, unregister: vi.fn(), setKeyboardLayout: vi.fn() },
  isValidElectronAccelerator: () => true
}))
vi.mock('main_renderer/keyboard', () => ({
  getKeyboardInfo: () => ({ layout: {}, keymap: {} }),
  keyboardLayoutMonitor: { addListener: vi.fn() }
}))

const tmpDirs: string[] = []
const makeKeybindings = (overrides: Record<string, string> = {}) => {
  const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-windows-redo-'))
  tmpDirs.push(userDataPath)
  fs.writeFileSync(path.join(userDataPath, 'keybindings.json'), JSON.stringify(overrides))
  const execute = vi.fn()
  const manager = { has: () => true, execute } as unknown as ConstructorParameters<typeof Keybindings>[0]
  const environment = { paths: { userDataPath }, isDevMode: false } as ConstructorParameters<typeof Keybindings>[1]
  return { bindings: new Keybindings(manager, environment), execute }
}

afterEach(() => {
  register.mockClear()
  for (const dir of tmpDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

describe('Windows redo shortcut (#2183)', () => {
  it('dispatches Ctrl+Y to redo without registering the old default', () => {
    const { bindings, execute } = makeKeybindings()
    const win = {} as Parameters<Keybindings['registerEditorKeyHandlers']>[0]
    bindings.registerEditorKeyHandlers(win)

    const redoRegistration = register.mock.calls.find(([, accelerator]) => accelerator === 'Ctrl+Y')
    expect(redoRegistration).toBeDefined()
    if (!redoRegistration) throw new Error('Ctrl+Y was not registered')
    redoRegistration[2]()
    expect(execute).toHaveBeenCalledExactlyOnceWith('edit.redo', win)
    expect(register.mock.calls.some(([, accelerator]) => isEqualAccelerator(accelerator, 'Ctrl+Shift+Z'))).toBe(false)
    expect(bindings.getAccelerator('edit.redo')).toBe('Ctrl+Y')
  })

  it.each(['Ctrl+Shift+Z', ''])('preserves an explicit user binding of %j', (accelerator) => {
    const { bindings } = makeKeybindings({ 'edit.redo': accelerator })
    expect(bindings.getAccelerator('edit.redo')).toBe(accelerator || null)
  })

  it('keeps Ctrl+Y distinct from other Windows commands and preserves other platforms', () => {
    expect(keybindingsWindows.get('edit.undo')).toBe('Ctrl+Z')
    for (const [id, accelerator] of keybindingsWindows) {
      if (id !== 'edit.redo' && accelerator) {
        expect(isEqualAccelerator(accelerator, 'Ctrl+Y'), id).toBe(false)
      }
    }
    expect(keybindingsLinux.get('edit.redo')).toBe('Ctrl+Shift+Z')
    expect(keybindingsLinux.get('format.inline-code')).toBe('Ctrl+Y')
    expect(keybindingsDarwin.get('edit.redo')).toBe('Command+Shift+Z')
  })
})
