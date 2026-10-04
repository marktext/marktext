import { describe, it, expect } from 'vitest'
import {
  createTextDirectionGesture,
  type GestureInput
} from 'main_renderer/keyboard/textDirectionGesture'

// Key events as Electron reports them in `before-input-event`: modifier flags
// describe the state *after* the event's own key is applied for keyDown, and
// the key being released is already cleared for keyUp.
const down = (key: string, code: string, mods: Partial<GestureInput> = {}): GestureInput => ({
  type: 'keyDown',
  key,
  code,
  control: false,
  shift: false,
  alt: false,
  meta: false,
  ...mods
})
const up = (key: string, code: string, mods: Partial<GestureInput> = {}): GestureInput => ({
  ...down(key, code, mods),
  type: 'keyUp'
})

describe('createTextDirectionGesture', () => {
  it('returns "rtl" when Ctrl is held and the right Shift is pressed and released', () => {
    const feed = createTextDirectionGesture()
    expect(feed(down('Control', 'ControlLeft', { control: true }))).toBeNull()
    expect(feed(down('Shift', 'ShiftRight', { control: true, shift: true }))).toBeNull()
    expect(feed(up('Shift', 'ShiftRight', { control: true }))).toBe('rtl')
  })

  it('returns "ltr" when Ctrl is held and the left Shift is pressed and released', () => {
    const feed = createTextDirectionGesture()
    feed(down('Control', 'ControlLeft', { control: true }))
    feed(down('Shift', 'ShiftLeft', { control: true, shift: true }))
    expect(feed(up('Shift', 'ShiftLeft', { control: true }))).toBe('ltr')
  })

  it('uses the side of Ctrl when Ctrl is pressed after Shift', () => {
    const right = createTextDirectionGesture()
    right(down('Shift', 'ShiftLeft', { shift: true }))
    right(down('Control', 'ControlRight', { control: true, shift: true }))
    expect(right(up('Control', 'ControlRight', { shift: true }))).toBe('rtl')

    const left = createTextDirectionGesture()
    left(down('Shift', 'ShiftRight', { shift: true }))
    left(down('Control', 'ControlLeft', { control: true, shift: true }))
    expect(left(up('Control', 'ControlLeft', { shift: true }))).toBe('ltr')
  })

  it('fires once per chord, on the first modifier release', () => {
    const feed = createTextDirectionGesture()
    feed(down('Control', 'ControlLeft', { control: true }))
    feed(down('Shift', 'ShiftRight', { control: true, shift: true }))
    expect(feed(up('Shift', 'ShiftRight', { control: true }))).toBe('rtl')
    expect(feed(up('Control', 'ControlLeft'))).toBeNull()
  })

  it('is cancelled by a non-modifier key pressed during the chord (Ctrl+Shift+Z)', () => {
    const feed = createTextDirectionGesture()
    feed(down('Control', 'ControlLeft', { control: true }))
    feed(down('Shift', 'ShiftRight', { control: true, shift: true }))
    feed(down('Z', 'KeyZ', { control: true, shift: true }))
    feed(up('Z', 'KeyZ', { control: true, shift: true }))
    expect(feed(up('Shift', 'ShiftRight', { control: true }))).toBeNull()
    expect(feed(up('Control', 'ControlLeft'))).toBeNull()
  })

  it('ignores chords that involve Alt', () => {
    const feed = createTextDirectionGesture()
    feed(down('Control', 'ControlLeft', { control: true }))
    feed(down('Alt', 'AltLeft', { control: true, alt: true }))
    feed(down('Shift', 'ShiftRight', { control: true, alt: true, shift: true }))
    expect(feed(up('Shift', 'ShiftRight', { control: true, alt: true }))).toBeNull()
  })

  it('ignores chords that involve Meta', () => {
    const feed = createTextDirectionGesture()
    feed(down('Control', 'ControlLeft', { control: true }))
    feed(down('Shift', 'ShiftRight', { control: true, shift: true, meta: true }))
    expect(feed(up('Shift', 'ShiftRight', { control: true, meta: true }))).toBeNull()
  })

  it('ignores Shift released without Ctrl', () => {
    const feed = createTextDirectionGesture()
    feed(down('Shift', 'ShiftRight', { shift: true }))
    expect(feed(up('Shift', 'ShiftRight'))).toBeNull()
  })

  it('ignores Ctrl released without Shift', () => {
    const feed = createTextDirectionGesture()
    feed(down('Control', 'ControlRight', { control: true }))
    expect(feed(up('Control', 'ControlRight'))).toBeNull()
  })

  it('recognises a new chord after a cancelled one', () => {
    const feed = createTextDirectionGesture()
    feed(down('Control', 'ControlLeft', { control: true }))
    feed(down('Z', 'KeyZ', { control: true }))
    feed(up('Z', 'KeyZ', { control: true }))
    feed(up('Control', 'ControlLeft'))

    feed(down('Control', 'ControlLeft', { control: true }))
    feed(down('Shift', 'ShiftLeft', { control: true, shift: true }))
    expect(feed(up('Shift', 'ShiftLeft', { control: true }))).toBe('ltr')
  })

  it('keeps state per instance', () => {
    const a = createTextDirectionGesture()
    const b = createTextDirectionGesture()
    a(down('Control', 'ControlLeft', { control: true }))
    a(down('Shift', 'ShiftRight', { control: true, shift: true }))
    expect(b(up('Shift', 'ShiftRight', { control: true }))).toBeNull()
    expect(a(up('Shift', 'ShiftRight', { control: true }))).toBe('rtl')
  })
})
