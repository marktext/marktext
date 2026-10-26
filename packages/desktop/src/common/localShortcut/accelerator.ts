import type { KeyEvent } from './keymap'

const MODIFIERS =
  /^(CommandOrControl|CmdOrCtrl|Command|Cmd|Control|Ctrl|AltGr|Option|Alt|Shift|Super)$/i
const KEY_CODES =
  /^(Num[0-9]|Plus|Space|Tab|Backspace|Delete|Insert|Return|Enter|Up|Down|Left|Right|Home|End|PageUp|PageDown|Escape|Esc|VolumeUp|VolumeDown|VolumeMute|MediaNextTrack|MediaPreviousTrack|MediaStop|MediaPlayPause|PrintScreen|F24|F23|F22|F21|F20|F19|F18|F17|F16|F15|F14|F13|F12|F11|F10|F9|F8|F7|F6|F5|F4|F3|F2|F1|[0-9A-Z)!@#$%^&*(:+<_>?~{|}";=,\-./`[\\\]'])$/i

export function toKeyEvent(accelerator: string, platform: string): KeyEvent {
  const event: KeyEvent = { key: null, ctrl: false, alt: false, shift: false, meta: false }
  for (const part of accelerator.split('+')) {
    const value = part.toLowerCase()
    if (MODIFIERS.test(value)) {
      let modifier: 'ctrl' | 'alt' | 'shift' | 'meta'
      switch (value) {
        case 'cmd':
        case 'command':
          if (platform !== 'darwin') throw new Error('Command requires macOS')
          modifier = 'meta'
          break
        case 'super':
          modifier = 'meta'
          break
        case 'ctrl':
        case 'control':
          modifier = 'ctrl'
          break
        case 'cmdorctrl':
        case 'commandorcontrol':
          modifier = platform === 'darwin' ? 'meta' : 'ctrl'
          break
        case 'option':
          if (platform !== 'darwin') throw new Error('Option requires macOS')
          modifier = 'alt'
          break
        case 'alt':
        case 'altgr':
          modifier = 'alt'
          break
        default:
          modifier = 'shift'
          break
      }
      if (event[modifier]) throw new Error(`Duplicate modifier: ${part}`)
      event[modifier] = true
    } else {
      if (!KEY_CODES.test(part) || event.key) throw new Error(`Invalid accelerator: ${accelerator}`)
      event.key =
        value === 'plus' ? '+' : value === 'esc' ? 'escape' : value === 'return' ? 'enter' : value
    }
  }
  if (!event.key) throw new Error(`Missing key: ${accelerator}`)
  return event
}

export function isValidAccelerator(accelerator: string, platform: string): boolean {
  try {
    toKeyEvent(accelerator, platform)
    return true
  } catch {
    return false
  }
}
