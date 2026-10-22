import { describe, expect, it, vi } from 'vitest'
import { isEqualAccelerator } from 'common/keybinding'
import keybindingsDarwin from 'main_renderer/keyboard/keybindingsDarwin'
import inlineFormatIcons from '@muyajs/core/ui/inlineFormatToolbar/config'

vi.mock('@muyajs/core/config', () => ({ isOsx: true }))

describe('macOS inline code shortcut (#3085)', () => {
  it('leaves window cycling unbound and keeps inline code distinct from rich-text copy', () => {
    const inlineCode = keybindingsDarwin.get('format.inline-code') ?? ''
    expect(isEqualAccelerator(inlineCode, 'Control+Command+C')).toBe(true)
    expect(keybindingsDarwin.get('edit.copy-as-rich')).toBe('Command+Shift+C')

    for (const [id, accelerator] of keybindingsDarwin) {
      if (!accelerator) continue
      expect(isEqualAccelerator(accelerator, 'Command+`'), id).toBe(false)
      if (id !== 'format.inline-code') {
        expect(isEqualAccelerator(accelerator, inlineCode), id).toBe(false)
      }
    }
  })

  it('shows the new macOS shortcut in the floating toolbar', () => {
    expect(inlineFormatIcons.find(icon => icon.type === 'inline_code')?.shortcut).toBe('⌃+⌘+C')
  })
})
