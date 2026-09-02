import { describe, expect, it } from 'vitest'
import { buildInlineFormatShortcuts } from '@/util/formatShortcuts'

// #4687: the inline format toolbar must advertise and apply the user's
// CURRENT keybindings. This util turns the `mt::keybindings-response` map
// (command id → Electron accelerator) into muya's `inlineFormatShortcuts`
// option: a display label plus — when the combo is expressible for muya's
// Cmd/Ctrl-gated internal handler — a key matcher.

describe('buildInlineFormatShortcuts', () => {
  it('maps the macOS defaults to symbol labels and lowercase key matchers', () => {
    const shortcuts = buildInlineFormatShortcuts(
      {
        'format.strong': 'Command+B',
        'format.highlight': 'Shift+Command+H',
        'format.inline-code': 'Command+`'
      },
      true
    )

    expect(shortcuts.strong).toEqual({ label: '⌘+B', key: 'b', shiftKey: false, altKey: false })
    expect(shortcuts.mark).toEqual({ label: '⇧+⌘+H', key: 'h', shiftKey: true, altKey: false })
    expect(shortcuts.inline_code).toEqual({ label: '⌘+`', key: '`', shiftKey: false, altKey: false })
  })

  it('maps Windows/Linux accelerators to word labels', () => {
    const shortcuts = buildInlineFormatShortcuts(
      {
        'format.strong': 'Ctrl+B',
        // Linux's inline-code default diverges from the hardcoded muya hint —
        // exactly the case the dynamic map exists for.
        'format.inline-code': 'Ctrl+Y'
      },
      false
    )

    expect(shortcuts.strong).toEqual({ label: 'Ctrl+B', key: 'b', shiftKey: false, altKey: false })
    expect(shortcuts.inline_code).toEqual({ label: 'Ctrl+Y', key: 'y', shiftKey: false, altKey: false })
  })

  it('understands CmdOrCtrl and Alt/Option modifiers', () => {
    const shortcuts = buildInlineFormatShortcuts(
      {
        'format.strong': 'CmdOrCtrl+Alt+B'
      },
      false
    )

    expect(shortcuts.strong).toEqual({ label: 'Ctrl+Alt+B', key: 'b', shiftKey: false, altKey: true })
  })

  it('emits a hint-less, matcher-less entry for an unbound command', () => {
    const shortcuts = buildInlineFormatShortcuts({ 'format.strong': '' }, true)

    expect(shortcuts.strong).toEqual({ label: '' })
  })

  it('emits a hint-only entry for combos muya cannot match internally', () => {
    const shortcuts = buildInlineFormatShortcuts(
      {
        // No Cmd/Ctrl — the application menu owns applying it.
        'format.strong': 'F6',
        // Named (multi-character) key.
        'format.emphasis': 'Ctrl+Plus'
      },
      false
    )

    expect(shortcuts.strong).toEqual({ label: 'F6' })
    expect(shortcuts.em).toEqual({ label: 'Ctrl+Plus' })
  })

  it('leaves format types absent from the payload on their muya defaults', () => {
    const shortcuts = buildInlineFormatShortcuts({ 'format.strong': 'Ctrl+B' }, false)

    expect(Object.keys(shortcuts)).toEqual(['strong'])
  })

  it('ignores non-format command ids', () => {
    const shortcuts = buildInlineFormatShortcuts(
      {
        'file.save': 'Ctrl+S',
        'format.strong': 'Ctrl+B'
      },
      false
    )

    expect(Object.keys(shortcuts)).toEqual(['strong'])
  })
})
