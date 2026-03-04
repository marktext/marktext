const isOsx = process.platform === 'darwin'

// Map of lowercase modifier/key names to their canonical Electron accelerator form.
const MODIFIER_CAPITALIZATION = {
  commandorcontrol: 'CommandOrControl',
  cmdorctrl: 'CmdOrCtrl',
  command: 'Command',
  control: 'Control',
  ctrl: 'Ctrl',
  cmd: 'Cmd',
  alt: 'Alt',
  option: 'Option',
  altgr: 'AltGr',
  shift: 'Shift',
  meta: 'Meta',
  super: 'Super'
}

/**
 * Capitalize an accelerator string to match Electron's expected format.
 * e.g. "ctrl+alt+1" -> "Ctrl+Alt+1", "shift+a" -> "Shift+A"
 *
 * @param {string} accelerator
 * @returns {string}
 */
export const capitalizeAccelerator = accelerator => {
  if (!accelerator) return accelerator
  return accelerator.split('+').map(part => {
    const lower = part.toLowerCase()
    return MODIFIER_CAPITALIZATION[lower] || part
  }).join('+')
}

const _normalizeAccelerator = accelerator => {
  return accelerator.toLowerCase()
    .replace('commandorcontrol', isOsx ? 'cmd' : 'ctrl')
    .replace('cmdorctrl', isOsx ? 'cmd' : 'ctrl')
    .replace('control', 'ctrl')
    .replace('meta', 'cmd') // meta := cmd (macOS only) or super
    .replace('command', 'cmd')
    .replace('option', 'alt')
}

export const isEqualAccelerator = (a, b) => {
  a = _normalizeAccelerator(a)
  b = _normalizeAccelerator(b)
  const i1 = a.indexOf('+')
  const i2 = b.indexOf('+')
  if (i1 === -1 && i2 === -1) {
    return a === b
  } else if (i1 === -1 || i2 === -1) {
    return false
  }

  const partsA = a.split('+')
  const partsB = b.split('+')
  if (partsA.length !== partsB.length) {
    return false
  }

  const intersection = new Set([...partsA, ...partsB])
  return intersection.size === partsB.length
}
