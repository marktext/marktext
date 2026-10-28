import type CodeMirror from 'codemirror'
import type { Muya, TSelectionState } from '@muyajs/core'
import type { DocumentViewState, SourcePosition } from '@shared/types/files'
import { STATE_LIMITS } from '@shared/types/applicationState'

type SourceView = Pick<
  CodeMirror.Editor,
  'getValue' | 'getCursor' | 'setSelection' | 'lineCount' | 'getLine' | 'getScrollInfo' | 'scrollTo'
>
interface RenderedView {
  engine: Pick<Muya, 'getMarkdown' | 'getSelectionState' | 'setSelection' | 'setCursorByOffset'>
  container: HTMLElement
  refreshToc?(): void
}
interface ViewPorts {
  source?: SourceView
  rendered?: RenderedView
  collapsedOutlineKeys?: string[]
  isCurrent?: () => boolean
}
const nonnegative = (value: number): number => (Number.isFinite(value) ? Math.max(0, value) : 0)
const position = (source: SourceView, value: SourcePosition): SourcePosition => {
  const line = Math.min(Math.floor(nonnegative(value.line)), source.lineCount() - 1)
  return { line, ch: Math.min(Math.floor(nonnegative(value.ch)), source.getLine(line).length) }
}
const keys = (values: string[]): string[] =>
  [...new Set(values.filter((value) => typeof value === 'string'))].slice(
    0,
    STATE_LIMITS.collapsedOutlineKeysPerDocument
  )
export const hashEditorMarkdown = async(markdown: string): Promise<string> => {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(markdown))
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Applies editor view state without reading or writing document files or editor contents. */
export class DocumentViewAdapter {
  constructor(private readonly hash: (markdown: string) => Promise<string> = hashEditorMarkdown) {}

  async capture(markdown: string, ports: ViewPorts): Promise<DocumentViewState> {
    const source = ports.source
    const selection = !source ? (ports.rendered?.engine.getSelectionState() ?? null) : null
    const captured = {
      sourceSelection:
        source?.getValue() === markdown
          ? {
            anchor: position(source, source.getCursor('anchor')),
            focus: position(source, source.getCursor('head'))
          }
          : null,
      muyaSelection: selection
        ? (JSON.parse(JSON.stringify(selection)) as DocumentViewState['muyaSelection'])
        : null,
      sourceScrollTopPx: nonnegative(source?.getScrollInfo().top ?? 0),
      renderedScrollTopPx: nonnegative(ports.rendered?.container.scrollTop ?? 0),
      collapsedOutlineKeys: keys(ports.collapsedOutlineKeys ?? [])
    }
    return { ...captured, contentSha256: await this.hash(markdown) }
  }

  async restore(
    markdown: string,
    state: DocumentViewState | null,
    ports: ViewPorts,
    enabled = true
  ): Promise<string[]> {
    const matching =
      enabled && state !== null && state.contentSha256 === (await this.hash(markdown))
    if (ports.isCurrent && !ports.isCurrent()) return []
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const source = ports.source
    if (source) {
      const selection = enabled ? state?.sourceSelection : null
      const anchor = position(source, selection?.anchor ?? { line: 0, ch: 0 })
      const focus = position(source, selection?.focus ?? { line: 0, ch: 0 })
      source.setSelection(anchor, focus, { scroll: false })
      source.scrollTo(null, enabled ? nonnegative(state?.sourceScrollTopPx ?? 0) : 0)
    }
    if (ports.rendered) {
      const { engine, container } = ports.rendered
      let restored = false
      if (matching && state?.muyaSelection) {
        try {
          const selection = JSON.parse(JSON.stringify(state.muyaSelection)) as TSelectionState
          restored = engine.setSelection(selection)
        } catch {
          restored = false
        }
      }
      if (!restored)
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
  id: string,
  markdown: string,
  collapsedOutlineKeys: string[],
  previous: DocumentViewState | null = null
): Promise<DocumentViewState> => {
  const ports = portsFor(id)
  const captured = await adapter.capture(markdown, { ...ports, collapsedOutlineKeys })
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
export const isDocumentViewReady = (id: string, markdown: string): boolean => {
  const ports = portsFor(id)
  return ports.source
    ? ports.source.getValue() === markdown
    : rendered?.documentId() === id && rendered.markdown() === markdown
}
export const restoreDocumentView = (
  id: string,
  markdown: string,
  state: DocumentViewState | null,
  isCurrent: () => boolean,
  enabled = true
): Promise<string[]> =>
  adapter.restore(
    markdown,
    state,
    {
      ...portsFor(id),
      rendered: source?.documentId() === id ? undefined : portsFor(id).rendered,
      isCurrent
    },
    enabled
  )
