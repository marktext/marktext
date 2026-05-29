// Core file/tab/document shapes shared between main and renderer.
//
// Concrete fields are populated as call-sites convert to TS in subsequent
// commits. Until then, these are intentionally open structures — better an
// imperfect surface than a placeholder that's wrong.

export type LineEnding = 'lf' | 'crlf'

export interface SerializedStat {
  size: number
  mtimeMs: number
  isFile: boolean
  isDirectory: boolean
  isSymbolicLink?: boolean
}

export interface MarkdownDocument {
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

// Individual frames pushed by Muya's history. Shape is opaque to the
// renderer store; we only key off the id for the saved-snapshot check.
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

/**
 * Per-tab editor state — the canonical document state shape shared between
 * the renderer Pinia store, the buffered-state persistence layer, and
 * cross-process IPC payloads. Mirrors `defaultFileState` in
 * `src/renderer/src/store/help.ts`.
 */
export interface IFileState {
  id: string
  filename: string
  // Falsy (`''`) for untitled buffers; pre-migration this was sometimes
  // missing entirely. Always a string at runtime now.
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

/**
 * Per-tab notification banner. Pushed via the editor store's
 * `pushTabNotification` action; consumed by `notifications.vue`.
 */
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
  selected?: boolean
  [key: string]: unknown
}

export interface SaveOptions {
  // Encoding is the `FileEncoding` object at runtime (`{ encoding, isBom }`).
  // String form is accepted for legacy callers that haven't been updated.
  encoding?: FileEncoding | string
  lineEnding?: LineEnding | string
  adjustLineEndingOnSave?: boolean
  trimTrailingNewline?: number
}

/**
 * Per-tab payload sent with `mt::close-window-confirm` / `mt::save-tabs` /
 * `mt::save-and-close-tabs` when the renderer asks main to surface a
 * "save unsaved changes?" dialog. Mirrors the runtime shape consumed by
 * `showUnsavedFilesMessage` in `src/main/menu/actions/file.ts`.
 */
export interface UnsavedFile {
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
  /**
   * Raw markdown contents used to seed new untitled tabs. Main fills this
   * from `_markdownToOpen` (e.g. stdin-piped launches and
   * `mt::new-tab-with-content`); empty when no seed content was supplied.
   */
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
