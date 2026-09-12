// CodeMirror's `lineNumberFormatter` receives a 1-based line number and returns
// the label to render in the gutter; returning '' hides the label for that row.

type LineNumberFormatter = (line: number) => number | string

/**
 * Build a `lineNumberFormatter` for source-code mode.
 *
 * @param freq How often a line number is shown: 1 labels every line, N labels
 *   every Nth line. Line 1 is always labelled (existing convention) so the top
 *   of the document keeps a reference number. `freq` of 0 means "no numbers";
 *   callers disable the gutter entirely in that case, so the returned formatter
 *   is never invoked and simply hides every label.
 */
export const makeLineNumberFormatter = (freq: number): LineNumberFormatter => {
  if (freq <= 0) {
    return () => ''
  }
  if (freq === 1) {
    return (line: number) => line
  }
  return (line: number) => (line % freq === 0 || line === 1 ? line : '')
}
