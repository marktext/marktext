let documentView: ((readOnly: boolean) => void) | null = null
let sourceView: (() => Promise<void>) | null = null

export const registerDocumentView = (view: typeof documentView): void => {
  documentView = view
}

export const registerSourceView = (view: (() => Promise<void>) | null): void => {
  sourceView = view
}

export const prepareReading = async(): Promise<void> => {
  if (sourceView) await sourceView()
  documentView?.(true)
}

export const applyReadOnly = (value: boolean): void => {
  documentView?.(value)
}

interface SourceHistoryView {
  getValue: () => string
  getHistory: () => unknown
  setHistory: (history: unknown) => void
  setValue: (value: string) => void
  clearHistory: () => void
}

const sourceHistory = new Map<
  string,
  { markdown: string; canonicalMarkdown: string; history: unknown }
>()

export const captureSourceHistory = (
  id: string | null,
  view: SourceHistoryView,
  canonicalMarkdown = view.getValue()
): void => {
  if (id)
    sourceHistory.set(id, {
      markdown: view.getValue(),
      canonicalMarkdown,
      history: view.getHistory()
    })
}

export const restoreSourceHistory = (id: string, view: SourceHistoryView): void => {
  const cached = sourceHistory.get(id)
  // CodeMirror retains undo history across setValue, even when the next tab has identical text.
  view.clearHistory()
  if (
    cached &&
    (cached.markdown === view.getValue() || cached.canonicalMarkdown === view.getValue())
  ) {
    if (cached.markdown !== view.getValue()) view.setValue(cached.markdown)
    view.setHistory(cached.history)
  }
}

export const pruneSourceHistory = (ids: Set<string>): void => {
  for (const id of sourceHistory.keys()) if (!ids.has(id)) sourceHistory.delete(id)
}
