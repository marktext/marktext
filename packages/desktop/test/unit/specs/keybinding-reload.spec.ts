import { describe, it, expect, vi, afterEach } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs'

// Main-process slice: instantiate the real `Keybindings` against a temp config
// dir and a fake window, then verify that saving new user keybindings applies
// them live (re-registers shortcuts) rather than only persisting to disk.

const { register, unregister } = vi.hoisted(() => ({
  register: vi.fn(),
  unregister: vi.fn()
}))

vi.mock('electron', () => ({
  shell: { openPath: vi.fn(), openExternal: vi.fn() }
}))

vi.mock('@hfelix/electron-localshortcut', () => ({
  electronLocalshortcut: {
    register,
    unregister,
    setKeyboardLayout: vi.fn()
  },
  isValidElectronAccelerator: () => true
}))

vi.mock('main_renderer/keyboard', () => ({
  getKeyboardInfo: () => ({ layout: {}, keymap: {} }),
  keyboardLayoutMonitor: { addListener: vi.fn() }
}))

import Keybindings from 'main_renderer/keyboard/shortcutHandler'

type CommandManagerArg = ConstructorParameters<typeof Keybindings>[0]
type AppEnvironmentArg = ConstructorParameters<typeof Keybindings>[1]
type WinArg = Parameters<Keybindings['registerEditorKeyHandlers']>[0]

const tmpDirs: string[] = []

const makeKeybindings = () => {
  const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-keybindings-'))
  tmpDirs.push(userDataPath)
  const commandManager = {
    has: () => true,
    execute: vi.fn()
  } as unknown as CommandManagerArg
  const appEnvironment = {
    paths: { userDataPath },
    isDevMode: false
  } as unknown as AppEnvironmentArg
  return new Keybindings(commandManager, appEnvironment)
}

afterEach(() => {
  register.mockClear()
  unregister.mockClear()
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('Keybindings.setUserKeybindings live re-registration (#3681)', () => {
  it('re-registers shortcuts on open windows so changes apply without a restart', async() => {
    const kb = makeKeybindings()
    const win = { isDestroyed: () => false } as unknown as WinArg
    register.mockClear()
    unregister.mockClear()

    const NEW_ACCEL = 'CmdOrCtrl+Alt+Shift+S'
    await kb.setUserKeybindings(new Map([['file.save', NEW_ACCEL]]), [win])

    // The active key map reflects the new binding immediately.
    expect(kb.getAccelerator('file.save')).toBe(NEW_ACCEL)
    // The changed accelerator is registered live on the open window.
    expect(register).toHaveBeenCalledWith(win, NEW_ACCEL, expect.any(Function))
    // The previously registered accelerators were torn down first.
    expect(unregister).toHaveBeenCalled()
  })

  it('skips destroyed windows', async() => {
    const kb = makeKeybindings()
    const win = { isDestroyed: () => true } as unknown as WinArg
    register.mockClear()

    await kb.setUserKeybindings(new Map([['file.save', 'CmdOrCtrl+Alt+Shift+S']]), [win])

    expect(register).not.toHaveBeenCalled()
  })
})
