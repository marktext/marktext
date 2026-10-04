/** The one editor shortcut that still runs while the terminal owns the keyboard. */
export const TERMINAL_PANEL_TOGGLE = 'view.toggle-terminal'

/**
 * Editor shortcuts are delivered from the main process before the page sees the key.
 * A focused terminal must receive that key instead, except the panel toggle.
 */
export const claimEditorShortcut = (terminalFocused: boolean, commandId: string): boolean => {
  if (!terminalFocused) return true
  return commandId === TERMINAL_PANEL_TOGGLE
}
