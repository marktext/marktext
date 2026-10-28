// Core file/tab/document shapes shared between main and renderer.

export type LineEnding = 'lf' | 'crlf'

export interface SerializedStat {
  size: number
  birthtimeMs: number
  mtimeMs: number
  ctimeMs: number
  isFile: boolean
  isDirectory: boolean
  isSymbolicLink?: boolean
}

export interface FileHistory {
  stack: HistoryStackEntry[]
  index: number
  // Tracked by Muya to know which history frame represents the last edit
  // and the initial document. -1 when undefined.
  lastEditIndex?: number
  lastInitIndex?: number
}

export interface HistoryStackEntry {
  id: number | string
  [key: string]: unknown
}

export interface FileEncoding {
  encoding: string
  isBom: boolean
}

export interface FileWordCount {
  paragraph: number
  word: number
  character: number
  all: number
}

export interface FileSearchMatches {
  index: number
  matches: unknown[]
  value: string
}

/** Canonical per-tab state shared by renderer stores, buffered persistence and IPC. */
export interface IFileState {
  readOnly: boolean
  // Transient navigation state; deliberately excluded from buffered tab state.
  isPreview: boolean
  modeChanging?: boolean
  acceptedDiskSha256?: string
  diskMissing?: boolean
  diskConflict?: boolean
  // A named CLI buffer can be unmodified while its target does not exist yet.
  isPendingCreation?: boolean
  id: string
  filename: string
  // Empty for untitled buffers; always a string at runtime.
  pathname: string
  markdown: string
  isSaved: boolean
  encoding: FileEncoding
  lineEnding: LineEnding | string
  adjustLineEndingOnSave: boolean
  trimTrailingNewline: number
  history: FileHistory
  cursor: unknown
  wordCount: FileWordCount
  searchMatches: FileSearchMatches
  scrollTop: number
  // View state for this open tab; deliberately excluded from buffered persistence.
  tocCollapsedKeys?: string[]
  viewState?: DocumentViewState | null
  muyaIndexCursor: unknown
  notifications: FileNotification[]
  // Muya block tree; only populated for the actively edited tab.
  blocks?: unknown
  isMixedLineEndings?: boolean
}

export interface FileNotification {
  msg: string
  showConfirm: boolean
  style: string
  exclusiveType: string
  action: (status?: unknown) => void
}

export type ITab = IFileState

export interface FileChangeDetail {
  pathname: string
  type?: string
  [key: string]: unknown
}

export interface TabOptions {
  readOnly?: boolean
  selected?: boolean
  /** Link fragment to reveal once the tab is active, e.g. `setup` from `other.md#setup`. */
  anchor?: string
  [key: string]: unknown
}

export interface SidebarOpenOptions extends TabOptions {
  preview?: boolean
  requestId?: number
}

export interface PageOptions {
  pageSize?: string
  pageSizeWidth?: number
  pageSizeHeight?: number
  isLandscape?: boolean
  printBackground?: boolean
  [key: string]: unknown
}

export type ExportType = 'pdf' | 'html' | 'styledHtml' | 'png' | 'jpeg'

export interface PandocExportPayload {
  githubAlerts?: boolean
  /** One of `PANDOC_EXPORT_FORMATS[].id`. */
  target: string
  markdown: string
  /** Names the output when the tab has no path yet. */
  title: string
  /** Folder pandoc resolves the document's relative links against. */
  pathname: string
  /** Reader preferences only the renderer knows; see `getPandocReader`. */
  superSubScript: boolean
  footnote: boolean
  texMathDollars: boolean
  texMathGfm: boolean
  texMathSingleBackslash: boolean
  texMathDoubleBackslash: boolean
}

/** Position in normalized editor text, independent of its disk line endings. */
export interface SourcePosition {
  // Both are zero-based; ch counts UTF-16 code units.
  line: number
  ch: number
}

/** Preserves selection direction; anchor and focus may appear in either text order. */
export interface SourceSelection {
  anchor: SourcePosition
  focus: SourcePosition
}

/** Path through a reconstructed Muya block tree and the offset within that block. */
export interface MuyaEndpoint {
  path: Array<string | number>
  offset: number
}

/** JSON-safe Muya selection; valid only while the captured content hash still matches. */
export type MuyaSelection =
  | { kind: 'text'; anchor: MuyaEndpoint; focus: MuyaEndpoint }
  | {
    kind: 'image'
    path: Array<string | number>
    range: { start: number; end: number }
    raw: string
  }
  | {
    kind: 'table'
    tablePath: Array<string | number>
    anchor: { row: number; column: number }
    focus: { row: number; column: number }
  }

/** Independent rendered/source positions plus folding state for one document. */
export interface DocumentViewState {
  // Hash of the editor's Markdown string encoded as UTF-8, not the raw disk bytes.
  contentSha256: string
  sourceSelection: SourceSelection | null
  muyaSelection: MuyaSelection | null
  // CSS-pixel offsets in the corresponding editor scroll container.
  sourceScrollTopPx: number
  renderedScrollTopPx: number
  // Heading identities, not Muya DOM or block references.
  collapsedOutlineKeys: string[]
}

/** Save-affecting options participate in dirty detection alongside Markdown text. */
export interface SaveFormatState {
  encoding: FileEncoding
  lineEnding: LineEnding
  adjustLineEndingOnSave: boolean
  trimTrailingNewline: 0 | 1 | 2 | 3
}

/** Raw on-disk bytes observed before editing; differs from the normalized editor hash. */
export type DiskBaseline =
  { exists: false } | { exists: true; sizeBytes: number; mtimeMs: number; rawSha256: string }
