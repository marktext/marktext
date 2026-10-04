const focused = new Set<number>()

export const setTerminalFocused = (windowId: number, value: boolean): void => {
  if (value) focused.add(windowId)
  else focused.delete(windowId)
}

export const isTerminalFocused = (windowId: number): boolean => focused.has(windowId)

export const clearTerminalFocus = (windowId: number): void => {
  focused.delete(windowId)
}
