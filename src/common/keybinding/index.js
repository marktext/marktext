const isOsx = process.platform === 'darwin'

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
