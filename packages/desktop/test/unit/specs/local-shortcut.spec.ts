import { EventEmitter } from 'node:events'
import type { BrowserWindow, Input } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import {
  KeyboardMapper,
  acceleratorFromKeyEvent,
  equalKeyEvents,
  type KeyboardInput
} from 'common/localShortcut/keymap'
import { isValidAccelerator, toKeyEvent } from 'common/localShortcut/accelerator'
import { electronLocalshortcut } from 'common/localShortcut'

const input = (overrides: Partial<KeyboardInput> = {}): KeyboardInput => ({
  type: 'keydown',
  key: '7',
  code: 'Digit7',
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  getModifierState: () => false,
  ...overrides
})

describe.each(['darwin', 'win32', 'linux'])('shared recording and matching on %s', (platform) => {
  const primary = platform === 'darwin' ? 'Command' : 'Ctrl'
  const flags = platform === 'darwin' ? { metaKey: true } : { ctrlKey: true }

  it('detects literal-symbol conflicts with explicitly shifted chords', () => {
    const mapper = new KeyboardMapper(platform)
    for (const [symbol, base] of [['Plus', '='], ['&', '7'], ['?', '/']]) {
      expect(equalKeyEvents(
        mapper.normalizeBinding(toKeyEvent(`${primary}+${symbol}`, platform)),
        mapper.normalizeBinding(toKeyEvent(`${primary}+Shift+${base}`, platform))
      )).toBe(true)
    }
    expect(equalKeyEvents(
      mapper.normalizeBinding(toKeyEvent(`${primary}+=`, platform)),
      mapper.normalizeBinding(toKeyEvent(`${primary}+Shift+=`, platform))
    )).toBe(false)
  })

  it.each([
    ['7', 'Digit7'],
    ['/', 'Slash'],
    ['=', 'Equal']
  ])('keeps shifted %s distinct from the unshifted key', (key, code) => {
    const mapper = new KeyboardMapper(platform)
    const event = mapper.normalize(input({ ...flags, key, code, shiftKey: true }))!
    const recorded = acceleratorFromKeyEvent(event, platform)
    expect(isValidAccelerator(recorded, platform)).toBe(true)
    expect(equalKeyEvents(event, toKeyEvent(`${primary}+Shift+${key}`, platform))).toBe(true)
    expect(equalKeyEvents(event, toKeyEvent(`${primary}+${key}`, platform))).toBe(false)
    expect(
      equalKeyEvents(
        mapper.normalize(input({ ...flags, key, code }))!,
        toKeyEvent(recorded, platform)
      )
    ).toBe(false)
  })

  it('preserves ordinary shifted characters, letters, caps lock and function keys', () => {
    const mapper = new KeyboardMapper(platform)
    expect(
      acceleratorFromKeyEvent(mapper.normalize(input({ key: '&', shiftKey: true })), platform)
    ).toBe('&')
    expect(
      equalKeyEvents(
        mapper.normalize(input({ ...flags, key: 'B', code: 'KeyB', shiftKey: true }))!,
        toKeyEvent(`${primary}+Shift+B`, platform)
      )
    ).toBe(true)
    expect(
      equalKeyEvents(
        mapper.normalize(input({ ...flags, key: 'B', code: 'KeyB' }))!,
        toKeyEvent(`${primary}+B`, platform)
      )
    ).toBe(true)
    expect(
      equalKeyEvents(
        mapper.normalize(input({ ...flags, key: 'F12', code: 'F12', shiftKey: true }))!,
        toKeyEvent(`${primary}+Shift+F12`, platform)
      )
    ).toBe(true)
  })

  it.each([
    ['&', '7', 'Digit7'],
    ['?', '/', 'Slash'],
    ['+', '=', 'Equal']
  ])(
    'records shifted symbol %s as an explicit chord and retains literal bindings',
    (symbol, base, code) => {
      const mapper = new KeyboardMapper(platform)
      const event = mapper.normalize(input({ ...flags, key: symbol, code, shiftKey: true }))!
      const recorded = toKeyEvent(acceleratorFromKeyEvent(event, platform), platform)
      expect(equalKeyEvents(event, toKeyEvent(`${primary}+Shift+${base}`, platform))).toBe(true)
      expect(
        equalKeyEvents(
          event,
          toKeyEvent(`${primary}+${symbol === '+' ? 'Plus' : symbol}`, platform)
        )
      ).toBe(true)
      expect(equalKeyEvents(event, toKeyEvent(`${primary}+${base}`, platform))).toBe(false)
      expect(equalKeyEvents(event, recorded)).toBe(true)
    }
  )

  it('preserves non-Latin US-equivalent shortcuts and unknown-code safety', () => {
    const mapper = new KeyboardMapper(platform)
    mapper.setKeyboardLayout({ id: 'cyrillic' }, { KeyA: { value: 'ф' }, KeyC: { value: 'с' } })
    expect(
      equalKeyEvents(
        mapper.normalize(input({ ...flags, key: 'с', code: 'KeyC' }))!,
        toKeyEvent(`${primary}+C`, platform)
      )
    ).toBe(true)
    expect(() =>
      mapper.normalize(input({ ...flags, key: 'x', code: 'Unknown', altKey: true }))
    ).not.toThrow()
  })

  it('validates modifiers, aliases and primary keys consistently', () => {
    expect(isValidAccelerator(`${primary}+Shift+7`, platform)).toBe(true)
    expect(isValidAccelerator('Ctrl+Ctrl+A', platform)).toBe(false)
    expect(isValidAccelerator('Ctrl', platform)).toBe(false)
    expect(isValidAccelerator('Ctrl+?', platform)).toBe(true)
    expect(toKeyEvent('Ctrl+Return', platform).key).toBe('enter')
    expect(toKeyEvent('Ctrl+Esc', platform).key).toBe('escape')
    expect(toKeyEvent('Ctrl+Plus', platform).key).toBe('+')
  })
})

it('retains Windows AltGr ASCII text and maps macOS Option shortcuts with primary modifiers', () => {
  const windows = new KeyboardMapper('win32')
  windows.setKeyboardLayout(
    { name: 'international' },
    { KeyQ: { value: 'q', withShift: 'Q', withAltGr: '@' } }
  )
  const text = windows.normalize(
    input({
      key: '@',
      code: 'KeyQ',
      ctrlKey: true,
      altKey: true,
      getModifierState: (name) => name === 'AltGraph'
    })
  )!
  expect(text).toMatchObject({ key: '@', ctrl: false, alt: false })
  const mac = new KeyboardMapper('darwin')
  expect(
    equalKeyEvents(
      mac.normalize(input({ key: 'π', code: 'KeyP', metaKey: true, altKey: true }))!,
      toKeyEvent('Command+Option+P', 'darwin')
    )
  ).toBe(true)
  mac.setKeyboardLayout(
    { id: 'com.apple.keylayout.DVORAK-QWERTYCMD' },
    { KeyC: { value: 'j', withShift: 'J' } }
  )
  expect(
    equalKeyEvents(
      mac.normalize(input({ key: 'j', code: 'KeyC', metaKey: true }))!,
      toKeyEvent('Command+C', 'darwin')
    )
  ).toBe(true)
})

it('retains dead-key and numpad mapping', () => {
  const mapper = new KeyboardMapper('darwin')
  mapper.setKeyboardLayout(
    { id: 'dead-key-layout' },
    { BracketLeft: { value: '^', withShift: '¨' } }
  )
  expect(mapper.normalize(input({ key: 'Dead', code: 'BracketLeft', ctrlKey: true }))?.key).toBe(
    '^'
  )
  expect(mapper.normalize(input({ key: '1', code: 'Numpad1', ctrlKey: true }))?.key).toBe('num1')
})

function fakeWindow() {
  const contents = new EventEmitter()
  const win = { webContents: contents, isDestroyed: () => false } as unknown as BrowserWindow
  return { contents, win }
}

it('dispatches shifted runtime input once and cleans window listeners after unregistering', () => {
  const { contents, win } = fakeWindow()
  const primary = process.platform === 'darwin' ? 'Command' : 'Ctrl'
  const callback = vi.fn(() => true)
  const plain = vi.fn(() => true)
  electronLocalshortcut.register(win, `${primary}+Shift+7`, callback)
  electronLocalshortcut.register(win, `${primary}+7`, plain)
  const event = { preventDefault: vi.fn() }
  const key: Input = {
    type: 'keyDown',
    key: '7',
    code: 'Digit7',
    control: process.platform !== 'darwin',
    meta: process.platform === 'darwin',
    shift: true,
    alt: false,
    isAutoRepeat: false,
    isComposing: false,
    location: 0,
    modifiers: []
  }
  contents.emit('before-input-event', event, key)
  expect(callback).toHaveBeenCalledTimes(1)
  expect(plain).not.toHaveBeenCalled()
  expect(event.preventDefault).toHaveBeenCalledTimes(1)
  electronLocalshortcut.disableAll(win)
  contents.emit('before-input-event', event, key)
  expect(callback).toHaveBeenCalledTimes(1)
  electronLocalshortcut.enableAll(win)
  contents.emit('before-input-event', event, key)
  expect(callback).toHaveBeenCalledTimes(2)
  electronLocalshortcut.unregister(win, [`${primary}+Shift+7`, `${primary}+7`])
  expect(contents.listenerCount('before-input-event')).toBe(0)
  expect(contents.listenerCount('destroyed')).toBe(0)
})

it('isolates registrations by window and ignores composition and key-up events', () => {
  const first = fakeWindow()
  const second = fakeWindow()
  const callback = vi.fn(() => true)
  electronLocalshortcut.register(first.win, 'Ctrl+B', callback)
  electronLocalshortcut.register(second.win, 'Ctrl+I', callback)
  const event = { preventDefault: vi.fn() }
  const key: Input = {
    type: 'keyUp',
    key: 'b',
    code: 'KeyB',
    control: true,
    meta: false,
    shift: false,
    alt: false,
    isAutoRepeat: false,
    isComposing: false,
    location: 0,
    modifiers: []
  }
  first.contents.emit('before-input-event', event, key)
  first.contents.emit('before-input-event', event, { ...key, type: 'keyDown', isComposing: true })
  second.contents.emit('before-input-event', event, { ...key, type: 'keyDown' })
  expect(callback).not.toHaveBeenCalled()
  first.contents.emit('destroyed')
  expect(first.contents.listenerCount('before-input-event')).toBe(0)
  electronLocalshortcut.unregisterAll(second.win)
})
