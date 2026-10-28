import type { PreferenceUpdateResult, UserPreferences, UserPreferencesPatch } from './preferences'
import type { DocumentViewState, DiskBaseline, SaveFormatState } from './files'
/** UUID of a native editor window; independent of Electron process IDs. */
export type WindowStateId = string
/** UUID shared by windows belonging to one application launch. */
export type SessionId = string
/** SHA-256 of the sorted canonical root identities. */
export type WorkspaceId = string
/** Canonical root location key. */
export type RootId = string
/** UUID of an editing instance; opening one path twice creates distinct IDs. */
export type DocumentId = string
/** SHA-256 of an absolute canonical path. */
export type ResourceKey = string
/** Lowercase hexadecimal SHA-256 digest. */
export type Sha256 = string
/** Unix epoch time in milliseconds. */
export type TimestampMs = number

/** User-facing path and its canonical identity, including not-yet-created files. */
export interface FileLocation {
  // Absolute path retained for display and subsequent file operations.
  path: string
  // Resolves existing ancestor symlinks while preserving any missing suffix.
  canonicalPath: string
  key: ResourceKey
}

export interface WorkspaceRoot {
  id: RootId
  location: FileLocation
}

/** An ordered set of roots whose identity is independent of presentation order. */
export interface WorkspaceDescriptor {
  id: WorkspaceId
  // Root order affects display, not workspace identity.
  roots: WorkspaceRoot[]
}

/** Normal bounds and maximized intent; restored bounds are fitted to available displays. */
export interface WindowGeometryState {
  // Electron screen coordinates and bounds are device-independent pixels.
  normalBounds: { x: number; y: number; width: number; height: number }
  maximized: boolean
  // Electron display ID, serialized as text; null lets placement select a display.
  displayId: string | null
}

/** Preferred window layout, before viewport clamps or temporary mode overrides. */
export interface WindowLayoutState {
  sidebar: {
    visible: boolean
    activeView: 'files' | 'search'
    // Remembered CSS-pixel width, including while the sidebar is hidden.
    preferredWidthPx: number
    openedFiles: { expanded: boolean; preferredHeightPx: number }
  }
  outline: {
    visible: boolean
    position: 'left' | 'right'
    preferredWidthPx: number
  }
  tabBar: { visible: boolean }
  // Store intent before focus/read-only modes temporarily suppress UI elements.
  modes: { sourceCode: boolean; focus: boolean; typewriter: boolean }
}

/** Folder folding owned by one workspace root. */
export interface RootViewState {
  rootId: RootId
  // Relative to this root; an empty string identifies the root itself.
  collapsedPaths: string[]
}

/** Folding state for roots that still belong to the current workspace. */
export interface ProjectViewState {
  roots: RootViewState[]
}

/** A named document may still have no file on disk when pendingCreation is true. */
export type DocumentResource =
  { kind: 'untitled' } | { kind: 'file'; location: FileLocation; pendingCreation: boolean }

/** Disk-backed, untouched blank, or recoverable unsaved content; excludes the body itself. */
export type DocumentContentState =
  | { kind: 'disk'; baseline: DiskBaseline }
  | { kind: 'empty' }
  | { kind: 'recovery'; contentRevision: number }

/** Serializable document metadata; the main process owns resource and content truth. */
export interface DocumentSnapshot {
  id: DocumentId
  title: string
  resource: DocumentResource
  content: DocumentContentState
  readOnly: boolean
  saveFormat: SaveFormatState
  view: DocumentViewState | null
}

/** Serializable window identity, native placement, layout and ordered document membership. */
export interface WindowSnapshot {
  id: WindowStateId
  updatedAtMs: TimestampMs
  // Fallback selection when activeWindowId no longer refers to a restored window.
  lastActivatedAtMs: TimestampMs
  // Null denotes a window with no folder roots.
  workspace: WorkspaceDescriptor | null
  geometry: WindowGeometryState
  layout: WindowLayoutState
  projectView: ProjectViewState
  // Array order is tab order. There is at most one tab per document in a window.
  documents: DocumentSnapshot[]
  activeDocumentId: DocumentId | null
}

/** Closed means a normal quit completed; its windows remain available for the next launch. */
export const SessionLifecycle = { RUNNING: 'running', CLOSED: 'closed' } as const

/** Current launch membership with at most one fallback after the final window closes. */
export interface SessionState {
  id: SessionId
  lifecycle: (typeof SessionLifecycle)[keyof typeof SessionLifecycle]
  windows: WindowSnapshot[]
  // Preferred startup window; null when no live editor remains.
  activeWindowId: WindowStateId | null
  // Populated only when no editor windows remain; never an archive of closed windows.
  lastWindow: WindowSnapshot | null
}

/** Reopening template for a real saved file, without draft identity or recovery content. */
export interface WorkspaceFileState {
  location: FileLocation
  readOnly: boolean
  saveFormat: SaveFormatState
  view: DocumentViewState | null
}

/** Bounded workspace cache; the active source window wins over background copies. */
export interface WorkspaceRecentState {
  workspace: WorkspaceDescriptor
  updatedAtMs: TimestampMs
  // Identifies the window allowed to refresh this cached workspace in the background.
  sourceWindowId: WindowStateId
  layout: WindowLayoutState
  projectView: ProjectViewState
  // Reopening templates only: no draft IDs, recovery references, or Markdown bodies.
  files: WorkspaceFileState[]
  activeFileKey: ResourceKey | null
}

/** Versioned metadata index; Markdown bodies live in separate recovery records. */
export interface ApplicationState {
  schemaVersion: 1
  // Advances only after a successful metadata replacement.
  revision: number
  updatedAtMs: TimestampMs
  session: SessionState
  lastActiveWorkspaceId: WorkspaceId | null
  // Most recently active first. Active window snapshots do not depend on this cache.
  recentWorkspaces: WorkspaceRecentState[]
  recentEmptyWindowLayout: {
    updatedAtMs: TimestampMs
    layout: WindowLayoutState
  } | null
}

/** Serialized recovery states; keep values stable for records already on disk. */
export const RecoveryStatus = {
  DIRTY: 'dirty',
  SAVED: 'saved',
  DISCARDED: 'discarded'
} as const

/** Self-contained unsaved content with the disk baseline used for conflict checks. */
export interface DirtyRecoveryRecord {
  schemaVersion: 1
  status: typeof RecoveryStatus.DIRTY
  ownerWindowId: WindowStateId
  documentId: DocumentId
  contentRevision: number
  updatedAtMs: TimestampMs
  document: DocumentSnapshot
  markdown: string
  contentSha256: Sha256
  // Original disk state before unsaved edits, retained even if the file changes later.
  baseline: DiskBaseline | null
}

/** Retains a completed save or Save As result across an interrupted metadata commit. */
export interface SavedRecoveryRecord {
  schemaVersion: 1
  status: typeof RecoveryStatus.SAVED
  ownerWindowId: WindowStateId
  documentId: DocumentId
  contentRevision: number
  updatedAtMs: TimestampMs
  document: DocumentSnapshot
}

/** Prevents explicitly closed or discarded content from being restored after a crash. */
export interface DiscardedRecoveryRecord {
  schemaVersion: 1
  status: typeof RecoveryStatus.DISCARDED
  ownerWindowId: WindowStateId
  documentId: DocumentId
  contentRevision: number
  updatedAtMs: TimestampMs
}

// saved/discarded replace the same file until the metadata commit makes deletion safe.
export type RecoveryRecord = DirtyRecoveryRecord | SavedRecoveryRecord | DiscardedRecoveryRecord

/** A fresh token invalidates messages from a previous renderer or workspace context. */
export interface RuntimeWindowContext {
  contextToken: string
}

/** Renderer-editable document fields; resource paths and titles remain main-owned. */
export interface RendererDocumentCheckpoint {
  id: DocumentId
  content: DocumentContentState
  readOnly: boolean
  saveFormat: SaveFormatState
  view: DocumentViewState | null
}

/** Full Markdown at a monotonically increasing per-document content revision. */
export interface DirtyContentUpdate {
  documentId: DocumentId
  contentRevision: number
  markdown: string
}

/** Complete window membership plus bodies changed since the last acknowledged checkpoint. */
export interface WindowCheckpointRequest {
  contextToken: string
  // Strictly increases within one context token; identical requests may be retried.
  sequence: number
  // Null for normal checkpoints; otherwise matches the pending native close request.
  closeTransactionId: string | null
  layout: WindowLayoutState
  projectView: ProjectViewState
  documents: RendererDocumentCheckpoint[]
  activeDocumentId: DocumentId | null
  dirtyContents: DirtyContentUpdate[]
}

/** Metadata revision durably committed by this operation. */
export interface PersistReceipt {
  metadataRevision: number
}

/** Operational failures; unsupported disk formats are reported by LoadResult instead. */
export type PersistenceFailure =
  | 'invalid-data'
  | 'stale-context'
  | 'stale-sequence'
  | 'storage-unavailable'

/** Failure preserves live contents for retry and never implies a completed close. */
export type PersistResult =
  | { status: 'persisted'; receipt: PersistReceipt }
  | { status: 'failed'; reason: PersistenceFailure }

/** Initial state delivered through IPC after the main process attaches a renderer. */
export interface WindowInitialization {
  context: RuntimeWindowContext
  preferences: UserPreferences
  snapshot: WindowSnapshot
  // Runtime text also includes clean documents whose revisions survived a renderer reload.
  documentContents: DirtyContentUpdate[]
}

export type RegisterUntitledResult =
  | { status: 'registered'; document: DocumentSnapshot }
  | { status: 'failed'; reason: PersistenceFailure }

export interface StateIpcInvokeChannels {
  'mt::state::get-window-initialization': {
    args: []
    ret: WindowInitialization
  }
  'mt::state::register-untitled': {
    args: [request: { contextToken: string; title: string }]
    ret: RegisterUntitledResult
  }
  'mt::state::checkpoint': {
    args: [request: WindowCheckpointRequest]
    ret: PersistResult
  }
  'mt::state::flush': { args: [contextToken: string]; ret: PersistResult }
  'mt::preferences::get': { args: []; ret: UserPreferences }
  'mt::preferences::update': {
    args: [patch: UserPreferencesPatch]
    ret: PreferenceUpdateResult
  }
}

export interface StateIpcMainEvents {
  'mt::preferences::changed': [preferences: UserPreferences]
  'mt::state::prepare-close': [request: { contextToken: string; transactionId: string }]
  'mt::state::context-changed': [initialization: WindowInitialization]
}

/** Read-only defaults preserve an unreadable or invalid original file from replacement. */
export type LoadResult<T> =
  | { status: 'loaded'; value: T }
  | { status: 'defaulted'; value: T; reason: 'missing' }
  | {
    status: 'read-only-defaulted'
    value: T
    reason: 'invalid-data' | 'unreadable' | 'unsupported-version'
  }

/** Maximum counts for ordinary reopening caches; unsaved recovery content is never evicted. */
export interface PersistenceLimits {
  recentWorkspaces: number
  filesPerRecentWorkspace: number
  collapsedPathsPerRoot: number
  collapsedOutlineKeysPerDocument: number
}

export const STATE_LIMITS: PersistenceLimits = {
  recentWorkspaces: 50,
  filesPerRecentWorkspace: 100,
  collapsedPathsPerRoot: 2000,
  collapsedOutlineKeysPerDocument: 2000
}

/** Serializes metadata writes without interpreting editor commands. */
export interface ApplicationStateStorage {
  load(): Promise<LoadResult<ApplicationState>>
  write(state: ApplicationState): Promise<void>
}

/** Recovery records are isolated by owner window and document editing identity. */
export interface DocumentRecoveryStorage {
  readWindow(windowId: WindowStateId): Promise<RecoveryRecord[]>
  write(record: RecoveryRecord): Promise<void>
  remove(windowId: WindowStateId, documentId: DocumentId): Promise<void>
}

export interface WindowStateProvider {
  get(windowId: WindowStateId): WindowSnapshot | null
  update(snapshot: WindowSnapshot): void
}
