import { describe, expect, it } from 'vitest'
import keybindingsDarwin from 'main_renderer/keyboard/keybindingsDarwin'
import keybindingsLinux from 'main_renderer/keyboard/keybindingsLinux'
import keybindingsWindows from 'main_renderer/keyboard/keybindingsWindows'

describe('quick open recent default keybindings', () => {
  it('binds Control+R on macOS and leaves Windows and Linux unbound', () => {
    expect(keybindingsDarwin.get('file.quick-open-recent')).toBe('Control+R')
    expect(keybindingsWindows.get('file.quick-open-recent')).toBe('')
    expect(keybindingsLinux.get('file.quick-open-recent')).toBe('')
  })
})
