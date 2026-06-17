// Turn an Electron accelerator string (e.g. "Command+Shift+T") into the
// per-key tokens the command palette renders. On macOS modifiers become the
// native symbols (⌘ ⇧ ⌥ ⌃) so the palette matches the muya front menu and the
// system menus; elsewhere they stay readable words.

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
  return accelerator
    .split('+')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => map[part.toLowerCase()] ?? part)
}
