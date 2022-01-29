import { isEqualAccelerator } from 'common/keybinding'

const keys = [
  '0',
  '1',
  '9',
  'A',
  'G',
  'Z',
  'F1',
  'F5',
  'F24',
  '~',
  '!',
  '@',
  '#',
  'Plus',
  'Space',
  'Tab',
  'Backspace',
  'Delete',
  'Insert',
  'Return',
  'Enter',
  'Up',
  'Down',
  'Left',
  'Right',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Escape',
  'Esc',
  'VolumeUp',
  'VolumeDown',
  'VolumeMute',
  'MediaNextTrack',
  'MediaPreviousTrack',
  'MediaStop',
  'MediaPlayPause',
  'PrintScreen'
]

const modifiers = [
  'Command',
  'Cmd',
  'Control',
  'Ctrl',
  'CommandOrControl',
  'CmdOrCtrl',
  'Alt',
  'Option',
  'AltGr',
  'Shift'
]

describe('Test equal with basis keys', () => {
  it('Match Ctrl+A', () => {
    expect(isEqualAccelerator('Ctrl+A', 'A+Ctrl')).to.equal(true)
  })
  it('Match case insensitive with multiple modifiers', () => {
    expect(isEqualAccelerator('Ctrl+Alt+A', 'ctrl+alt+a')).to.equal(true)
  })
  it('Match case insensitive with multiple modifiers and upper-case letter', () => {
    expect(isEqualAccelerator('Ctrl+Shift+A', 'ctrl+shift+A')).to.equal(true)
  })
  it('Match mixed case with multiple modifiers', () => {
    expect(isEqualAccelerator('Ctrl+a+shift', 'ctrl+Shift+a')).to.equal(true)
  })
})

describe('Test not equal with basis keys', () => {
  it('Mismatch Ctrl+A', () => {
    expect(isEqualAccelerator('Ctrl+A', 'A+Ctrl+Alt')).to.equal(false)
  })
  it('Mismatch case insensitive with multiple modifiers', () => {
    expect(isEqualAccelerator('Ctrl+A', 'ctrl+alt+a')).to.equal(false)
  })
  it('Mismatch letters only', () => {
    expect(isEqualAccelerator('a', 'b')).to.equal(false)
  })
  it('Mismatch same modifiers but different key', () => {
    expect(isEqualAccelerator('Ctrl+a+shift', 'ctrl+Shift+b')).to.equal(false)
  })
})

describe('Test invalid accelerator', () => {
  it('Ctrl+', () => {
    expect(isEqualAccelerator('Ctrl+', 'Ctrl+Plus')).to.equal(false)
  })
  it('Ctrl++', () => {
    expect(isEqualAccelerator('Ctrl++', 'Ctrl+Plus')).to.equal(false)
  })
  it('Emtpy accelerator 1', () => {
    expect(isEqualAccelerator('', 'Ctrl+A')).to.equal(false)
  })
  it('Emtpy accelerator 2', () => {
    expect(isEqualAccelerator('ctrl+Shift+b', '')).to.equal(false)
  })
})

describe('Match all', () => {
  modifiers.forEach(mod =>
    keys.forEach(key => {
      it(`Should match ${mod}+${key}`, () => {
        expect(isEqualAccelerator(`${mod}+${key}`, `${key}+${mod}`)).to.equal(true)
      })
    })
  )
})
