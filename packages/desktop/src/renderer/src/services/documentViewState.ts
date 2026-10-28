import type CodeMirror from 'codemirror'
import type { Muya, TSelectionState } from '@muyajs/core'
import type { DocumentViewState, SourcePosition, IFileState } from '@shared/types/files'
import { STATE_LIMITS } from '@shared/types/applicationState'
import { getHash } from '@/util/fileSystem'
import { adjustTrailingNewlines } from '@/util/markdown'

interface SourceView {
  editor: Pick<CodeMirror.Editor, 'getValue' | 'getCursor' | 'setSelection' | 'lineCount' | 'getLine'>
  // CodeMirror renders full-height; its containing source pane owns scrolling.
  container: HTMLElement
}
interface RenderedView {
  engine: Pick<Muya, 'getMarkdown' | 'getSelectionState' | 'setSelection' | 'setCursorByOffset'>
  container: HTMLElement
  refreshToc?(): void
}
/** Only the active editor is exposed; isCurrent guards asynchronous hash completion. */
interface ViewPorts {
  source?: SourceView
  rendered?: RenderedView
  collapsedOutlineKeys?: string[]
  // Must match the policy used to normalize the tab Markdown.
  trimTrailingNewline?: number
  isCurrent?: () => boolean
  // Mode handoffs already synchronize the caret; only their stored scroll is restored.
  preserveCaret?: boolean
}
const nonnegative = (value: number): number => (Number.isFinite(value) ? Math.max(0, value) : 0)
const position = (source: SourceView['editor'], value: SourcePosition): SourcePosition => {
  const line = Math.min(Math.floor(nonnegative(value.line)), source.lineCount() - 1)
  return { line, ch: Math.min(Math.floor(nonnegative(value.ch)), source.getLine(line).length) }
}
const keys = (values: string[]): string[] =>
  [...new Set(values.filter((value) => typeof value === 'string'))].slice(
    0,
    STATE_LIMITS.collapsedOutlineKeysPerDocument
  )
/** Applies editor view state without reading or writing document files or editor contents. */
export class DocumentViewAdapter {
  constructor(
    private readonly _hash: (markdown: string) => Promise<string> =
      (markdown) => getHash(markdown, 'utf8', 'sha256')
  ) {}

  async capture(markdown: string, ports: ViewPorts): Promise<DocumentViewState> {
    const source = ports.source?.editor
    const selection = !source ? (ports.rendered?.engine.getSelectionState() ?? null) : null
    const captured = {
      sourceSelection:
        source &&
        adjustTrailingNewlines(source.getValue(), ports.trimTrailingNewline ?? 2) ===
          adjustTrailingNewlines(markdown, ports.trimTrailingNewline ?? 2)
          ? {
            anchor: position(source, source.getCursor('anchor')),
            focus: position(source, source.getCursor('head'))
          }
          : null,
      muyaSelection: selection
        ? (JSON.parse(JSON.stringify(selection)) as DocumentViewState['muyaSelection'])
        : null,
      sourceScrollTopPx: nonnegative(ports.source?.container.scrollTop ?? 0),
      renderedScrollTopPx: nonnegative(ports.rendered?.container.scrollTop ?? 0),
      collapsedOutlineKeys: keys(ports.collapsedOutlineKeys ?? [])
    }
    return { ...captured, contentSha256: await this._hash(markdown) }
  }

  async restore(
    markdown: string,
    state: DocumentViewState | null,
    ports: ViewPorts,
    enabled = true
  ): Promise<string[]> {
    const matching =
      enabled && state !== null && state.contentSha256 === (await this._hash(markdown))
    if (ports.isCurrent && !ports.isCurrent()) return []
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const source = ports.source
    if (source) {
      const selection = enabled ? state?.sourceSelection : null
      const anchor = position(source.editor, selection?.anchor ?? { line: 0, ch: 0 })
      const focus = position(source.editor, selection?.focus ?? { line: 0, ch: 0 })
      if (!ports.preserveCaret) source.editor.setSelection(anchor, focus, { scroll: false })
      source.container.scrollTop = enabled ? nonnegative(state?.sourceScrollTopPx ?? 0) : 0
    }
    if (ports.rendered) {
      const { engine, container } = ports.rendered
      let restored = false
      if (!ports.preserveCaret && matching && state?.muyaSelection) {
        try {
          const selection = JSON.parse(JSON.stringify(state.muyaSelection)) as TSelectionState
          restored = engine.setSelection(selection)
        } catch {
          restored = false
        }
      }
      if (!ports.preserveCaret && !restored)
        engine.setCursorByOffset({ anchor: { line: 0, ch: 0 }, focus: { line: 0, ch: 0 } })
      ports.rendered.refreshToc?.()
      container.scrollTop = enabled ? nonnegative(state?.renderedScrollTopPx ?? 0) : 0
    }
    if (
      focused &&
      focused !== document.body &&
      focused.isConnected &&
      !ports.rendered?.container.contains(focused)
    )
      focused.focus({ preventScroll: true })
    return matching && state ? keys(state.collapsedOutlineKeys) : []
  }
}

/** Teardown releases only its own editor binding, preserving a newer mounted view. */
interface Binding<T> {
  documentId: () => string | null
  view: T
}
let source: Binding<SourceView> | null = null
let rendered: (Binding<RenderedView> & { markdown: () => string }) | null = null
let changed: (() => void) | null = null
const adapter = new DocumentViewAdapter()

export const registerSourceViewState = (binding: Binding<SourceView>): (() => void) => {
  source = binding
  return () => {
    if (source === binding) source = null
  }
}
export const registerRenderedViewState = (
  binding: Binding<RenderedView> & { markdown: () => string }
): (() => void) => {
  rendered = binding
  return () => {
    if (rendered === binding) rendered = null
  }
}
export const onDocumentViewChange = (listener: (() => void) | null): void => {
  changed = listener
}
export const documentViewChanged = (): void => {
  changed?.()
}
const portsFor = (id: string): ViewPorts => ({
  source: source?.documentId() === id ? source.view : undefined,
  rendered: rendered?.documentId() === id ? rendered.view : undefined
})
export const captureDocumentView = async(
  file: Pick<IFileState, 'id' | 'markdown' | 'trimTrailingNewline' | 'tocCollapsedKeys' | 'viewState'>
): Promise<DocumentViewState> => {
  const { id, markdown, trimTrailingNewline, tocCollapsedKeys = [], viewState: previous } = file
  const ports = portsFor(id)
  const captured = await adapter.capture(markdown, {
    ...ports,
    collapsedOutlineKeys: tocCollapsedKeys,
    trimTrailingNewline
  })
  if (previous?.contentSha256 === captured.contentSha256) {
    if (!ports.source) {
      captured.sourceSelection = previous.sourceSelection
        ? JSON.parse(JSON.stringify(previous.sourceSelection))
        : null
      captured.sourceScrollTopPx = previous.sourceScrollTopPx
    } else {
      captured.muyaSelection = previous.muyaSelection
        ? JSON.parse(JSON.stringify(previous.muyaSelection))
        : null
      captured.renderedScrollTopPx = previous.renderedScrollTopPx
    }
  }
  return captured
}
export const isDocumentViewReady = (id: string, markdown: string, trimTrailingNewline = 2): boolean => {
  const ports = portsFor(id)
  const current = ports.source
    ? ports.source.editor.getValue()
    : rendered?.documentId() === id ? rendered.markdown() : null
  return current !== null &&
    adjustTrailingNewlines(current, trimTrailingNewline) === adjustTrailingNewlines(markdown, trimTrailingNewline)
}
export const restoreDocumentView = (
  id: string,
  markdown: string,
  state: DocumentViewState | null,
  isCurrent: () => boolean,
  preserveCaret = false
): Promise<string[]> => {
  const ports = portsFor(id)
  return adapter.restore(
    markdown,
    state,
    {
      ...ports,
      rendered: ports.source ? undefined : ports.rendered,
      isCurrent,
      preserveCaret
    }
  )
}
