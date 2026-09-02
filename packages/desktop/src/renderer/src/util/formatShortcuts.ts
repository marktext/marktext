import { acceleratorToTokens } from './accelerator'

// Desktop format command ids → the muya inline format toolbar's format types.
const FORMAT_COMMAND_TO_TYPE: Record<string, string> = {
  'format.strong': 'strong',
  'format.emphasis': 'em',
  'format.underline': 'u',
  'format.strike': 'del',
  'format.highlight': 'mark',
  'format.inline-code': 'inline_code',
  'format.inline-math': 'inline_math',
  'format.hyperlink': 'link',
  'format.image': 'image',
  'format.clear-format': 'clear'
}

// Mirrors muya's `IInlineFormatShortcut`. Restated here because the desktop
// consumes `@muyajs/core` through the permissive hand-written stub
// (`src/types/muya-core.d.ts`), which does not re-export the engine's types.
export interface InlineFormatShortcut {
  label: string
  key?: string
  shiftKey?: boolean
  altKey?: boolean
}

// Convert one Electron accelerator into a muya shortcut entry. A `key`
// matcher is only emitted for combos muya's Cmd/Ctrl-gated internal handler
// can express — Cmd/Ctrl (+Shift/+Alt) plus a single printable key. Anything
// else (function keys, named keys like `Plus`, combos without Cmd/Ctrl) is
// hint-only: the application menu owns applying those.
const toShortcut = (accelerator: string, isOsx: boolean): InlineFormatShortcut => {
  const label = acceleratorToTokens(accelerator, isOsx).join('+')
  let hasCmdOrCtrl = false
  let shiftKey = false
  let altKey = false
  const keys: string[] = []

  for (const part of accelerator.split('+')) {
    const token = part.trim()
    if (!token) {
      continue
    }
    switch (token.toLowerCase()) {
      case 'cmdorctrl':
      case 'commandorcontrol':
      case 'command':
      case 'cmd':
      case 'control':
      case 'ctrl':
      case 'meta':
      case 'super':
        hasCmdOrCtrl = true
        break
      case 'shift':
        shiftKey = true
        break
      case 'alt':
      case 'option':
        altKey = true
        break
      default:
        keys.push(token)
    }
  }

  if (!hasCmdOrCtrl || keys.length !== 1 || keys[0].length !== 1) {
    return { label }
  }
  return { label, key: keys[0].toLowerCase(), shiftKey, altKey }
}

/**
 * Build the `inlineFormatShortcuts` muya option from the keybinding map the
 * main process broadcasts (`mt::keybindings-response`, command id →
 * accelerator), so the inline format toolbar advertises and applies the
 * user's CURRENT bindings instead of muya's bundled defaults (#4687). An
 * unbound command ('') yields a hint-less, matcher-less entry — the stale
 * default combo must neither show nor keep working.
 */
export const buildInlineFormatShortcuts = (
  keybindings: Record<string, string>,
  isOsx: boolean
): Record<string, InlineFormatShortcut> => {
  const shortcuts: Record<string, InlineFormatShortcut> = {}
  for (const [commandId, type] of Object.entries(FORMAT_COMMAND_TO_TYPE)) {
    const accelerator = keybindings[commandId]
    if (typeof accelerator !== 'string') {
      continue
    }
    shortcuts[type] = accelerator === '' ? { label: '' } : toShortcut(accelerator, isOsx)
  }
  return shortcuts
}
