import { describe, it, expect } from 'vitest'
import { getAcceleratorFromKeyboardEvent } from '@hfelix/electron-localshortcut'

// #4863: the atom-keymap port keeps Shift as a modifier only for non-character
// keys and upper-case Latin letters. For digits/punctuation held with a primary
// modifier (Cmd/Ctrl) the OS reports the base character (⌘⇧7 -> key "7"), so
// Shift was dropped from BOTH the recorded accelerator and the runtime match,
// leaving the binding unreachable. The patch in
// `packages/desktop/patches/@hfelix+electron-localshortcut+4.0.1.patch` also
// preserves Shift whenever ctrl/meta is held.
//
// This exercises the patched library through its public recorder API. The Ctrl
// path is platform-independent (Ctrl is honoured on every OS; the meta path is
// gated on macOS inside the library), so it fails on CI too if the patch is lost.
// Recorder and matcher share the same `normalizeKeyboardEvent`, so guarding the
// recorded string guards the match as well.

const press = (o: Record<string, unknown>): KeyboardEvent =>
  ({
    type: 'keydown',
    altKey: false,
    ctrlKey: false,
    shiftKey: false,
    metaKey: false,
    getModifierState: () => false,
    ...o
  }) as unknown as KeyboardEvent

const accelOf = (o: Record<string, unknown>): string =>
  (getAcceleratorFromKeyboardEvent(press(o)) as { accelerator: string }).accelerator

describe('atom-keymap Shift preservation with a primary modifier (#4863)', () => {
  it('keeps Shift for Ctrl+Shift+digit', () => {
    expect(accelOf({ key: '7', code: 'Digit7', ctrlKey: true, shiftKey: true })).toBe('ctrl+shift+7')
  })

  it('keeps Shift for Ctrl+Shift+punctuation', () => {
    expect(accelOf({ key: '/', code: 'Slash', ctrlKey: true, shiftKey: true })).toBe('ctrl+shift+/')
  })

  it('keeps a plain Ctrl+digit distinct from the shifted combo', () => {
    expect(accelOf({ key: '7', code: 'Digit7', ctrlKey: true })).toBe('ctrl+7')
  })

  it('still records the shifted character when no primary modifier is held', () => {
    // Shift+7 alone is intentionally recorded as the shifted character (US "&").
    expect(accelOf({ key: '&', code: 'Digit7', shiftKey: true })).toBe('&')
  })

  it('leaves upper-case letter combos unchanged', () => {
    expect(accelOf({ key: 'B', code: 'KeyB', ctrlKey: true, shiftKey: true })).toBe('ctrl+shift+B')
  })
})
