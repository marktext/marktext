import type { KeyMap } from 'codemirror'

export const getSourceExtraKeys = (isWindows: boolean): KeyMap => {
  // Main-process shortcuts honor user overrides before CodeMirror receives the event.
  // Suppress native redo bindings so unbinding or rebinding redo also takes effect.
  return isWindows ? { 'Shift-Ctrl-Z': () => {}, 'Ctrl-Y': () => {} } : {}
}
