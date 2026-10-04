export interface TerminalColors {
  background: string
  foreground: string
  cursor: string
  cursorAccent: string
  selectionBackground: string
}

const color = (pick: (name: string) => string, name: string, fallback: string): string => {
  const value = pick(name).trim()
  return value.length > 0 ? value : fallback
}

/** Cursor and selection use the theme accent. Background and text are the editor's. */
export const terminalColors = (pick: (name: string) => string): TerminalColors => {
  const background = color(pick, '--editorBgColor', '#ffffff')
  return {
    background,
    foreground: color(pick, '--editorColor', '#333333'),
    cursor: color(pick, '--themeColor', '#21b56f'),
    cursorAccent: background,
    selectionBackground: color(pick, '--themeColor10', 'rgba(33, 181, 111, 0.28)')
  }
}
