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

// Electron accelerators are order-insensitive, but the default keybinding maps
// spell the modifiers inconsistently (`Shift+Command+N`, `Cmd+Shift+G`,
// `Ctrl+Command+F`). Render them in one order — Command, Control, Option/Alt,
// Shift — with `Cmd` spelled `Command`, so a column of bindings reads
// consistently. `Cmd`/`Command` are the same modifier (see
// common/keybinding/index.ts). Display only; the stored value is untouched.
const MODIFIER_RANK: Record<string, number> = {
  command: 0,
  cmd: 0,
  cmdorctrl: 0,
  commandorcontrol: 0,
  control: 1,
  ctrl: 1,
  option: 2,
  alt: 2,
  altgr: 2,
  shift: 3
}

export const formatAcceleratorDisplay = (accelerator: string): string => {
  const parts = accelerator
    .split('+')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  if (parts.length < 2) {
    return accelerator
  }
  const modifiers = parts.slice(0, -1)
  const rankOf = (part: string): number | undefined => MODIFIER_RANK[part.toLowerCase()]
  // Leave anything unrecognised (a bare key, an unusual token) exactly as given.
  if (modifiers.some((part) => rankOf(part) === undefined)) {
    return accelerator
  }
  const sorted = [...modifiers].sort((a, b) => (rankOf(a) as number) - (rankOf(b) as number))
  const display = sorted.map((part) => (part.toLowerCase() === 'cmd' ? 'Command' : part))
  return [...display, parts[parts.length - 1]].join('+')
}
