import usKeymap from './usKeymap'

export interface KeyCharacters {
  value?: string | null
  withShift?: string | null
  withAltGr?: string | null
  withShiftAltGr?: string | null
}
export type KeyboardMap = Readonly<Record<string, KeyCharacters>>
export interface KeyboardLayout {
  name?: string
  layout?: string
  id?: string
}
export interface KeyboardInput {
  type: string
  key: string
  code: string
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
  getModifierState: (modifier: string) => boolean
  isComposing?: boolean
  keyCode?: number
}
export interface KeyEvent {
  key: string | null
  shiftedKey?: string
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
}

const US_KEYMAP: KeyboardMap = usKeymap

const KEY_NAMES: Record<string, string> = { Space: 'space', Backspace: 'backspace' }
const NON_CHARACTER_NAMES: Record<string, string> = {
  Control: 'ctrl',
  Meta: 'cmd',
  ArrowDown: 'down',
  ArrowUp: 'up',
  ArrowLeft: 'left',
  ArrowRight: 'right'
}
const MODIFIERS = new Set(['ctrl', 'alt', 'shift', 'cmd', 'super'])
const isCharacter = (key: string): boolean => key.length === 1
const isASCII = (key: string): boolean => isCharacter(key) && key.charCodeAt(0) <= 127
const isLatin = (key: string): boolean => isCharacter(key) && key.charCodeAt(0) <= 0x024f

// Adapted from @hfelix/electron-localshortcut 4.0.1 / atom-keymap; see LICENSE.
export class KeyboardMapper {
  private keymap: KeyboardMap = US_KEYMAP
  private layoutName = 'us-default'

  constructor(readonly platform: string) {}

  setKeyboardLayout(layout: KeyboardLayout | null, keymap: KeyboardMap | null): void {
    this.keymap = keymap && Object.keys(keymap).length ? keymap : US_KEYMAP
    this.layoutName = layout?.name || layout?.layout || layout?.id || 'us-default'
  }

  /** Literal symbols can imply Shift on the active layout, so conflict checks must expand them. */
  normalizeBinding(event: KeyEvent): KeyEvent {
    if (!event.key || event.shift || (!event.ctrl && !event.meta)) return event
    const characters = Object.values(this.keymap).find(
      ({ value, withShift }) =>
        value &&
        withShift === event.key &&
        value !== withShift &&
        value.toUpperCase() === value.toLowerCase()
    )
    const base = characters?.value
    return base ? { ...event, key: base, shift: true } : event
  }

  normalize(event: KeyboardInput): KeyEvent | null {
    if (event.type !== 'keydown') return null
    const isMac = this.platform === 'darwin'
    const isWindows = this.platform === 'win32'
    const isLinux = this.platform === 'linux'
    let { key, ctrlKey, altKey } = event
    const { code, shiftKey, metaKey } = event
    let characters = this.keymap[code]

    if (key === 'Dead' && !isLinux && characters) {
      if (altKey && shiftKey) key = characters.withShiftAltGr ?? key
      else if (altKey) key = characters.withAltGr ?? key
      else if (shiftKey) key = characters.withShift ?? key
      else key = characters.value ?? key
    }
    if (/^Numpad[0-9]$/.test(code)) key = `num${code.slice(-1)}`
    key = KEY_NAMES[code] ?? key
    if (isLinux && code === 'NumpadDecimal' && !event.getModifierState('NumLock')) key = 'delete'
    if (isLinux && code === 'IntlRo' && key === 'Unidentified' && ctrlKey) key = '/'

    const nonCharacter = key.length > 1
    if (nonCharacter) {
      key = NON_CHARACTER_NAMES[key] ?? key.toLowerCase()
      if (key === 'altgraph' && isWindows) key = 'alt'
    } else {
      key = shiftKey ? key.toUpperCase() : key.toLowerCase()
      if (event.getModifierState('AltGraph') || (isMac && altKey)) {
        const base = shiftKey ? characters?.withShift : characters?.value
        if (isMac && code) {
          if (base && (ctrlKey || metaKey || !isASCII(key))) key = base
          else if (key !== base) altKey = false
        } else if (isWindows && code) {
          // AltGr characters must remain text input on international Windows layouts.
          if (base && (metaKey || !isASCII(key))) key = base
          else if (key !== base) {
            ctrlKey = false
            altKey = false
          }
        } else if (isLinux && base && (ctrlKey || altKey || metaKey)) {
          key = base
          altKey = event.getModifierState('AltGraph')
        }
      }
    }

    const latin = ['KeyA', 'KeyS', 'KeyD', 'KeyF'].every((code) => {
      const value = this.keymap[code]?.value
      return value == null || isLatin(value)
    })
    // Command uses QWERTY in this macOS layout; non-Latin layouts keep upstream US equivalents.
    if ((isCharacter(key) && !latin) || (metaKey && /DVORAK-QWERTYCMD/i.test(this.layoutName))) {
      const fallback = US_KEYMAP[code]
      key = (shiftKey ? fallback?.withShift : fallback?.value) ?? key
      characters = fallback
    }

    let shiftedKey: string | undefined
    const base = characters?.value
    const shifted = characters?.withShift
    // Some platforms report the base key under Command, others the shifted symbol.
    if (
      shiftKey &&
      (ctrlKey || metaKey) &&
      base &&
      shifted &&
      base !== shifted &&
      base.toUpperCase() === base.toLowerCase() &&
      (key === base || key === shifted)
    ) {
      key = base
      shiftedKey = shifted
    }

    return {
      key: MODIFIERS.has(key) ? null : key,
      ...(shiftedKey ? { shiftedKey } : {}),
      ctrl: key === 'ctrl' || ctrlKey,
      alt: key === 'alt' || altKey,
      // Recorder and runtime must retain the same Shift bit for primary-modifier chords (#4863).
      shift:
        key === 'shift' ||
        (shiftKey &&
          (nonCharacter || ctrlKey || metaKey || (isLatin(key) && key.toLowerCase() !== key))),
      meta: key === 'cmd' || key === 'super' || metaKey
    }
  }
}

export const isValidKeyBinding = (event: KeyEvent | null): event is KeyEvent =>
  !!event?.key &&
  !/^(?:°|´|altgraph|capslock|dead|unidentified)$/i.test(event.key) &&
  (event.key.length > 1 || event.ctrl || event.alt || event.shift || event.meta)

export const acceleratorFromKeyEvent = (event: KeyEvent | null, platform: string): string => {
  if (!event) return ''
  return [
    event.ctrl && 'ctrl',
    event.alt && 'alt',
    event.shift && 'shift',
    event.meta && (platform === 'darwin' ? 'cmd' : 'super'),
    event.key === '+' ? 'plus' : event.key
  ]
    .filter(Boolean)
    .join('+')
}

export const equalKeyEvents = (a: KeyEvent, b: KeyEvent): boolean => {
  if (a.ctrl !== b.ctrl || a.alt !== b.alt || a.meta !== b.meta) return false
  if (a.key?.toLowerCase() === b.key?.toLowerCase() && a.shift === b.shift) return true
  // Literal symbol bindings such as Ctrl+Plus already imply Shift on these keys.
  return !!(
    (a.shiftedKey && a.shift && !b.shift && a.shiftedKey === b.key) ||
    (b.shiftedKey && b.shift && !a.shift && b.shiftedKey === a.key)
  )
}
