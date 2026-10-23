import type { KeyMap } from 'codemirror'

export const getSourceExtraKeys = (isWindows: boolean): KeyMap => {
  // Main-process shortcuts honor user overrides before CodeMirror receives the event.
  // Suppress its built-in alias so Windows only uses the configured redo shortcut.
  return isWindows ? { 'Shift-Ctrl-Z': () => {} } : {}
}
