export interface RevealScrollInput {
  rowTopInContent: number
  rowHeight: number
  viewportHeight: number
  scrollHeight: number
  scrollTop: number
  // VS Code's `ListWidget.reveal` parameter: 0 pins the row to the viewport
  // top, 1 to the bottom, 0.5 (what the Explorer uses) centres it.
  relativeTop?: number
}

type VisibilityInput = Omit<RevealScrollInput, 'scrollHeight' | 'relativeTop'>

export const isRowFullyVisible = ({
  rowTopInContent,
  rowHeight,
  viewportHeight,
  scrollTop
}: VisibilityInput): boolean =>
  rowTopInContent >= scrollTop && rowTopInContent + rowHeight <= scrollTop + viewportHeight

/** Returns the `scrollTop` that reveals the row, or `null` when it already is. */
export const computeRevealScrollTop = ({
  rowTopInContent,
  rowHeight,
  viewportHeight,
  scrollHeight,
  scrollTop,
  relativeTop = 0.5
}: RevealScrollInput): number | null => {
  if (viewportHeight <= 0) return null
  if (isRowFullyVisible({ rowTopInContent, rowHeight, viewportHeight, scrollTop })) return null

  const maxScrollTop = Math.max(0, scrollHeight - viewportHeight)
  const target = relativeTop * (rowHeight - viewportHeight) + rowTopInContent
  return Math.min(Math.max(target, 0), maxScrollTop)
}
