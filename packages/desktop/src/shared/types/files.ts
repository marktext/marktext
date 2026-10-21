// Core file/tab/document shapes shared between main and renderer.
//
// Concrete fields are populated as call-sites convert to TS in subsequent
// commits. Until then, these are intentionally open structures — better an
// imperfect surface than a placeholder that's wrong.

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

export interface MarkdownDocument {
  isPendingCreation?: boolean
  markdown: string
  filename: string
  pathname: string | null
  encoding?: string
  lineEnding?: LineEnding
  adjustLineEndingOnSave?: boolean
  trimTrailingNewline?: number
  isMixedLineEndings?: boolean
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
  muyaIndexCursor: unknown
  notifications: FileNotification[]
  lastSavedHistoryId?: number
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

export interface SaveOptions {
  isPendingCreation?: boolean
  // Encoding is the `FileEncoding` object at runtime (`{ encoding, isBom }`).
  // String form is accepted for legacy callers that haven't been updated.
  encoding?: FileEncoding | string
  lineEnding?: LineEnding | string
  adjustLineEndingOnSave?: boolean
  trimTrailingNewline?: number
}

/** Unsaved tab payload for close-window and save-tabs confirmation requests. */
export interface UnsavedFile {
  readOnly?: boolean
  id: string
  filename: string
  pathname?: string
  markdown: string
  options: SaveOptions
  defaultPath?: string
}

export interface BootstrapEditorConfig {
  isNewWindow?: boolean
  addBlankTab?: boolean
  /** Seed Markdown for new untitled tabs, including stdin launches. */
  markdownList: string[]
  lineEnding: LineEnding
  sideBarVisibility: boolean
  tabBarVisibility: boolean
  sourceCodeModeEnabled: boolean
  preferences?: unknown
  userKeybindings?: unknown
  recentlyUsedFiles?: string[]
  windowId?: number
  [key: string]: unknown
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
