import type { ProjectRootsSnapshot } from './project'

import type { PreferenceUpdateResult, UserPreferences, UserPreferencesPatch } from './preferences'
export { RECOVERY_DEFAULTS } from './preferences'
export type {
  PreferenceUpdateResult,
  RecoveryPreferences,
  StartupAction,
  UserPreferences,
  UserPreferencesPatch
} from './preferences'
import type { DocumentViewState, DiskBaseline, SaveFormatState } from './files'
export type {
  SourcePosition,
  SourceSelection,
  MuyaEndpoint,
  MuyaSelection,
  DocumentViewState,
  DiskBaseline,
  SaveFormatState
} from './files'
export type WindowStateId = string
export type SessionId = string
export type WorkspaceId = string
export type RootId = string
export type DocumentId = string
export type ResourceKey = string
export type Sha256 = string
export type TimestampMs = number

export interface FileLocation {
  path: string
  canonicalPath: string
  key: ResourceKey
}

export interface WorkspaceRoot {
  id: RootId
  location: FileLocation
}

export interface WorkspaceDescriptor {
  id: WorkspaceId
  // Root order affects display, not workspace identity.
  roots: WorkspaceRoot[]
}

export interface WindowGeometryState {
  // Electron screen coordinates and bounds are device-independent pixels.
  normalBounds: { x: number; y: number; width: number; height: number }
  maximized: boolean
  displayId: string | null
}

export interface WindowLayoutState {
  sidebar: {
    visible: boolean
    activeView: 'files' | 'search'
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

export interface RootViewState {
  rootId: RootId
  // Relative to this root; an empty string identifies the root itself.
  collapsedPaths: string[]
}

export interface ProjectViewState {
  roots: RootViewState[]
}

export type DocumentResource =
  { kind: 'untitled' } | { kind: 'file'; location: FileLocation; pendingCreation: boolean }

export type DocumentContentState =
  | { kind: 'disk'; baseline: DiskBaseline }
  | { kind: 'empty' }
  | { kind: 'recovery'; contentRevision: number }

export interface DocumentSnapshot {
  id: DocumentId
  title: string
  resource: DocumentResource
  content: DocumentContentState
  readOnly: boolean
  saveFormat: SaveFormatState
  view: DocumentViewState | null
}

export interface WindowSnapshot {
  id: WindowStateId
  updatedAtMs: TimestampMs
  lastActivatedAtMs: TimestampMs
  workspace: WorkspaceDescriptor | null
  geometry: WindowGeometryState
  layout: WindowLayoutState
  projectView: ProjectViewState
  // Array order is tab order. There is at most one tab per document in a window.
  documents: DocumentSnapshot[]
  activeDocumentId: DocumentId | null
}

export interface SessionState {
  id: SessionId
  lifecycle: 'running' | 'closed'
  windows: WindowSnapshot[]
  activeWindowId: WindowStateId | null
  // Populated only when no editor windows remain; never an archive of closed windows.
  lastWindow: WindowSnapshot | null
}

export interface WorkspaceFileState {
  location: FileLocation
  readOnly: boolean
  saveFormat: SaveFormatState
  view: DocumentViewState | null
}

export interface WorkspaceRecentState {
  workspace: WorkspaceDescriptor
  updatedAtMs: TimestampMs
  sourceWindowId: WindowStateId
  layout: WindowLayoutState
  projectView: ProjectViewState
  // Reopening templates only: no draft IDs, recovery references, or Markdown bodies.
  files: WorkspaceFileState[]
  activeFileKey: ResourceKey | null
}

export interface ApplicationState {
  schemaVersion: 1
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

export interface DirtyRecoveryRecord {
  schemaVersion: 1
  status: 'dirty'
  ownerWindowId: WindowStateId
  documentId: DocumentId
  contentRevision: number
  updatedAtMs: TimestampMs
  document: DocumentSnapshot
  markdown: string
  contentSha256: Sha256
  baseline: DiskBaseline | null
}

export interface SavedRecoveryRecord {
  schemaVersion: 1
  status: 'saved'
  ownerWindowId: WindowStateId
  documentId: DocumentId
  contentRevision: number
  updatedAtMs: TimestampMs
  document: DocumentSnapshot
}

export interface DiscardedRecoveryRecord {
  schemaVersion: 1
  status: 'discarded'
  ownerWindowId: WindowStateId
  documentId: DocumentId
  contentRevision: number
  updatedAtMs: TimestampMs
}

// saved/discarded replace the same file until the metadata commit makes deletion safe.
export type RecoveryRecord = DirtyRecoveryRecord | SavedRecoveryRecord | DiscardedRecoveryRecord

export interface RuntimeWindowContext {
  windowId: WindowStateId
  sessionId: SessionId
  contextToken: string
}

export interface RendererDocumentCheckpoint {
  id: DocumentId
  acceptedDiskSha256?: Sha256
  content: DocumentContentState
  readOnly: boolean
  saveFormat: SaveFormatState
  view: DocumentViewState | null
}

export interface DirtyContentUpdate {
  documentId: DocumentId
  contentRevision: number
  markdown: string
}

export interface WindowCheckpointRequest {
  contextToken: string
  sequence: number
  closeTransactionId: string | null
  layout: WindowLayoutState
  projectView: ProjectViewState
  documents: RendererDocumentCheckpoint[]
  activeDocumentId: DocumentId | null
  dirtyContents: DirtyContentUpdate[]
  previewDocumentId?: DocumentId | null
}

export interface PersistReceipt {
  metadataRevision: number
  sequence: number
  recoveryRevisions: Array<{ documentId: DocumentId; contentRevision: number }>
  documents?: DocumentSnapshot[]
}

export type PersistenceFailure =
  | 'invalid-data'
  | 'stale-context'
  | 'stale-sequence'
  | 'unsupported-version'
  | 'storage-unavailable'

export type PersistResult =
  | { status: 'persisted'; receipt: PersistReceipt }
  | { status: 'failed'; reason: PersistenceFailure }

export interface WindowInitialization {
  context: RuntimeWindowContext
  preferences: UserPreferences
  snapshot: WindowSnapshot
  // Runtime text also includes clean documents whose revisions survived a renderer reload.
  documentContents: DirtyContentUpdate[]
  projectRoots?: ProjectRootsSnapshot
  persistenceAvailable?: boolean
  startupWarning?: string
  documentStatuses?: Array<{ documentId: string; diskMissing: boolean; diskConflict: boolean }>
}

export interface ManagedDocumentPayload {
  document: DocumentSnapshot
  markdown: string
  contentRevision: number
  selected: boolean
  options?: { preview?: boolean; requestId?: number; anchor?: string }
  replacedDocumentIds?: DocumentId[]
}

export type ManagedSaveResult =
  | { status: 'saved'; document: DocumentSnapshot; savedMarkdown: string; savedFormat: SaveFormatState; metadataRevision: number }
  | { status: 'canceled' | 'failed' }

export type RegisterUntitledResult =
  | { status: 'registered'; document: DocumentSnapshot }
  | { status: 'failed'; reason: PersistenceFailure }

export interface StateIpcInvokeChannels {
  'mt::state::get-window-initialization': {
    args: []
    ret: WindowInitialization
  }
  'mt::state::register-untitled': {
    args: [request: { contextToken: string; title: string; markdown?: string; selected?: boolean }]
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
  'mt::preferences::choose-directory': { args: []; ret: string | null }
  'mt::state::save-document': { args: [contextToken: string, documentId: string, saveAs: boolean]; ret: ManagedSaveResult }
  'mt::state::close-documents': { args: [contextToken: string, documentIds: string[]]; ret: { status: 'closed' | 'canceled' | 'failed' } }
}

export interface StateIpcMainEvents {
  'mt::state::document-relocated': [document: DocumentSnapshot, metadataRevision: number]
  'mt::state::document-opened': [payload: ManagedDocumentPayload]
  'mt::state::documents-ended': [documentIds: string[]]
  'mt::state::document-saved': [result: Extract<ManagedSaveResult, { status: 'saved' }>]
  'mt::preferences::changed': [preferences: UserPreferences]
  'mt::state::prepare-close': [request: { contextToken: string; transactionId: string }]
  'mt::state::context-changed': [initialization: WindowInitialization]
}

export type LoadResult<T> =
  | { status: 'loaded'; value: T }
  | { status: 'defaulted'; value: T; reason: 'missing' }
  | {
    status: 'read-only-defaulted'
    value: T
    reason: 'invalid-data' | 'unreadable' | 'unsupported-version'
  }

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

export interface ApplicationStateStorage {
  load(): Promise<LoadResult<ApplicationState>>
  write(state: ApplicationState): Promise<void>
}

export interface DocumentRecoveryStorage {
  readWindow(windowId: WindowStateId): Promise<RecoveryRecord[]>
  write(record: RecoveryRecord): Promise<void>
  remove(windowId: WindowStateId, documentId: DocumentId): Promise<void>
}

export interface WindowStateProvider {
  get(windowId: WindowStateId): WindowSnapshot | null
  update(snapshot: WindowSnapshot): void
}
