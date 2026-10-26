// macOS accelerator modifiers use native symbols in the command palette.

const MAC_SYMBOLS: Record<string, string> = {
  cmdorctrl: '⌘',
  commandorcontrol: '⌘',
  command: '⌘',
  cmd: '⌘',
  meta: '⌘',
  super: '⌘',
  control: '⌃',
  ctrl: '⌃',
  shift: '⇧',
  option: '⌥',
  alt: '⌥'
}

const OTHER_WORDS: Record<string, string> = {
  cmdorctrl: 'Ctrl',
  commandorcontrol: 'Ctrl',
  command: 'Ctrl',
  cmd: 'Ctrl',
  control: 'Ctrl',
  ctrl: 'Ctrl',
  meta: 'Win',
  super: 'Win',
  shift: 'Shift',
  option: 'Alt',
  alt: 'Alt'
}

export const acceleratorToTokens = (accelerator: string, isOsx: boolean): string[] => {
  const map = isOsx ? MAC_SYMBOLS : OTHER_WORDS
  const order = isOsx ? ['⌃', '⌥', '⇧', '⌘'] : ['Ctrl', 'Alt', 'Shift', 'Win']
  const parts = accelerator
    .split('+')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  if (accelerator.trim().endsWith('++') || accelerator.trim() === '+') parts.push('Plus')
  const modifiers = parts.filter((part) => map[part.toLowerCase()])
    .map((part) => map[part.toLowerCase()])
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
  const keys = parts.filter((part) => !map[part.toLowerCase()])
    .map((part) => part.toLowerCase() === 'plus' ? '+' : /^[a-z]$/i.test(part) ? part.toUpperCase() : part)
  return [...new Set(modifiers), ...keys]
}

export const acceleratorToLabel = (accelerator: string, isOsx: boolean): string =>
  acceleratorToTokens(accelerator, isOsx).join(isOsx ? '' : '+')
