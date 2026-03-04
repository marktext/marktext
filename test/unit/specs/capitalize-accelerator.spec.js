import { capitalizeAccelerator } from 'common/keybinding'

describe('capitalizeAccelerator', () => {
  it('should capitalize single modifier + key', () => {
    expect(capitalizeAccelerator('ctrl+a')).to.equal('Ctrl+a')
  })

  it('should capitalize multiple modifiers', () => {
    expect(capitalizeAccelerator('ctrl+alt+1')).to.equal('Ctrl+Alt+1')
  })

  it('should capitalize ctrl+shift+key', () => {
    expect(capitalizeAccelerator('ctrl+shift+z')).to.equal('Ctrl+Shift+z')
  })

  it('should preserve already-capitalized accelerators', () => {
    expect(capitalizeAccelerator('Ctrl+Alt+1')).to.equal('Ctrl+Alt+1')
  })

  it('should handle CommandOrControl', () => {
    expect(capitalizeAccelerator('commandorcontrol+s')).to.equal('CommandOrControl+s')
  })

  it('should handle CmdOrCtrl', () => {
    expect(capitalizeAccelerator('cmdorctrl+n')).to.equal('CmdOrCtrl+n')
  })

  it('should handle Option modifier', () => {
    expect(capitalizeAccelerator('option+a')).to.equal('Option+a')
  })

  it('should handle AltGr modifier', () => {
    expect(capitalizeAccelerator('altgr+e')).to.equal('AltGr+e')
  })

  it('should handle Meta modifier', () => {
    expect(capitalizeAccelerator('meta+x')).to.equal('Meta+x')
  })

  it('should handle Super modifier', () => {
    expect(capitalizeAccelerator('super+l')).to.equal('Super+l')
  })

  it('should not alter non-modifier parts', () => {
    expect(capitalizeAccelerator('ctrl+F5')).to.equal('Ctrl+F5')
  })

  it('should handle single key without modifier', () => {
    expect(capitalizeAccelerator('F2')).to.equal('F2')
  })

  it('should return empty string for empty input', () => {
    expect(capitalizeAccelerator('')).to.equal('')
  })

  it('should return null for null input', () => {
    expect(capitalizeAccelerator(null)).to.equal(null)
  })

  it('should return undefined for undefined input', () => {
    expect(capitalizeAccelerator(undefined)).to.equal(undefined)
  })

  it('should handle mixed case input', () => {
    expect(capitalizeAccelerator('CTRL+ALT+a')).to.equal('Ctrl+Alt+a')
  })

  it('should handle three modifiers', () => {
    expect(capitalizeAccelerator('ctrl+shift+alt+d')).to.equal('Ctrl+Shift+Alt+d')
  })

  it('should handle Command modifier', () => {
    expect(capitalizeAccelerator('command+c')).to.equal('Command+c')
  })

  it('should handle Cmd modifier', () => {
    expect(capitalizeAccelerator('cmd+v')).to.equal('Cmd+v')
  })

  it('should handle Control modifier (full word)', () => {
    expect(capitalizeAccelerator('control+p')).to.equal('Control+p')
  })
})
