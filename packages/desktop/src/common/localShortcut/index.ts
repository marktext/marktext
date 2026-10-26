import type { BrowserWindow, Event as ElectronEvent, Input, WebContents } from 'electron'
import { isValidAccelerator, toKeyEvent } from './accelerator'
import {
  acceleratorFromKeyEvent,
  equalKeyEvents,
  isValidKeyBinding,
  KeyboardMapper,
  type KeyboardInput,
  type KeyboardLayout,
  type KeyboardMap,
  type KeyEvent
} from './keymap'

const mapper = new KeyboardMapper(process.platform)

export const setKeyboardLayout = (
  layout: KeyboardLayout | null,
  keymap: KeyboardMap | null
): void => mapper.setKeyboardLayout(layout, keymap)
export const isValidElectronAccelerator = (accelerator: string): boolean =>
  isValidAccelerator(accelerator, mapper.platform)
export const isCompositionEvent = (
  event: Pick<KeyboardInput, 'key' | 'isComposing' | 'keyCode'>
): boolean => !!event.isComposing || (event.keyCode === 229 && event.key !== 'Dead')
export const getAcceleratorFromKeyboardEvent = (
  event: KeyboardInput
): { accelerator: string; isValid: boolean } => {
  const normalized = mapper.normalize(event)
  return {
    accelerator: acceleratorFromKeyEvent(normalized, mapper.platform),
    isValid: isValidKeyBinding(normalized)
  }
}

interface Shortcut {
  event: KeyEvent
  callback: () => boolean | void
  enabled: boolean
}
interface WindowShortcuts {
  shortcuts: Shortcut[]
  altGr: boolean
  cleanup: () => void
}
const registry = new WeakMap<WebContents, WindowShortcuts>()

function getWindowShortcuts(win: BrowserWindow): WindowShortcuts {
  const wc = win.webContents
  const existing = registry.get(wc)
  if (existing) return existing
  const state: WindowShortcuts = { shortcuts: [], altGr: false, cleanup: () => {} }
  const handler = (event: ElectronEvent, input: Input): void => {
    if (mapper.platform !== 'darwin' && input.key === 'AltGraph')
      state.altGr = input.type === 'keyDown'
    if (
      input.type !== 'keyDown' ||
      input.isComposing ||
      (input.key === 'Unidentified' && input.code !== 'Dead' && input.code !== 'IntlRo')
    )
      return
    const normalized = mapper.normalize({
      type: 'keydown',
      key: input.key,
      code: input.code,
      ctrlKey: input.control,
      altKey: input.alt,
      shiftKey: input.shift,
      metaKey: input.meta,
      getModifierState: (modifier) =>
        modifier === 'AltGraph' &&
        (mapper.platform === 'darwin'
          ? input.alt
          : mapper.platform === 'win32'
            ? state.altGr || (input.control && input.alt)
            : state.altGr)
    })
    if (!isValidKeyBinding(normalized)) return
    const shortcut = state.shortcuts.find(
      (entry) => entry.enabled && equalKeyEvents(entry.event, normalized)
    )
    if (shortcut?.callback()) event.preventDefault()
  }
  state.cleanup = () => {
    wc.removeListener('before-input-event', handler)
    wc.removeListener('destroyed', state.cleanup)
    registry.delete(wc)
  }
  wc.on('before-input-event', handler)
  wc.once('destroyed', state.cleanup)
  registry.set(wc, state)
  return state
}

export const electronLocalshortcut = {
  register(
    win: BrowserWindow,
    accelerator: string | string[],
    callback: () => boolean | void
  ): void {
    for (const value of typeof accelerator === 'string' ? [accelerator] : accelerator) {
      const event = toKeyEvent(value, mapper.platform)
      getWindowShortcuts(win).shortcuts.push({ event, callback, enabled: true })
    }
  },
  unregister(win: BrowserWindow, accelerator: string | string[]): void {
    if (win.isDestroyed()) return
    const state = registry.get(win.webContents)
    if (!state) return
    for (const value of typeof accelerator === 'string' ? [accelerator] : accelerator) {
      const event = toKeyEvent(value, mapper.platform)
      state.shortcuts = state.shortcuts.filter((entry) => !equalKeyEvents(entry.event, event))
    }
    if (!state.shortcuts.length) state.cleanup()
  },
  unregisterAll(win: BrowserWindow): void {
    registry.get(win.webContents)?.cleanup()
  },
  isRegistered(win: BrowserWindow, accelerator: string): boolean {
    const event = toKeyEvent(accelerator, mapper.platform)
    return (
      registry
        .get(win.webContents)
        ?.shortcuts.some((entry) => equalKeyEvents(entry.event, event)) ?? false
    )
  },
  enableAll(win: BrowserWindow): void {
    for (const entry of registry.get(win.webContents)?.shortcuts ?? []) entry.enabled = true
  },
  disableAll(win: BrowserWindow): void {
    for (const entry of registry.get(win.webContents)?.shortcuts ?? []) entry.enabled = false
  },
  setKeyboardLayout
}
