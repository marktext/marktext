import type { IFileState } from './files'
import type { ManagedDocumentPayload, RuntimeWindowContext } from './applicationState'

export interface TabEditorHistory {
  rendered: unknown
  folds: unknown
  source: { markdown: string; canonicalMarkdown: string; history: unknown } | null
}

/** Nearest undo/redo boundary first; used only when crossing editor engines. */
export interface TabHistorySnapshots {
  undo: string[]
  redo: string[]
}

/** Transient editor data; document text and disk identity remain main-process owned. */
export interface TabRuntimeState {
  sourceCode: boolean
  snapshots: TabHistorySnapshots
  history: TabEditorHistory
  cursor: IFileState['cursor']
  muyaIndexCursor: IFileState['muyaIndexCursor']
  diskMissing?: boolean
  diskConflict?: boolean
}

export interface TabStripGeometry {
  left: number
  top: number
  right: number
  bottom: number
  tabs: Array<{ id: string; middle: number }>
}

/**
 * Prepare freezes/checkpoints both renderers; receive acknowledges an isolated staging copy.
 * Commit follows durable native ownership migration; release resumes ordinary checkpoints.
 */
export type TabTransferRequest =
  | { phase: 'prepare'; transactionId: string; documentId?: string }
  | {
    phase: 'receive'
    transactionId: string
    document: ManagedDocumentPayload
    runtime: TabRuntimeState
    beforeId: string | null
  }
  | {
    phase: 'commit'
    transactionId: string
    context: RuntimeWindowContext
    removeId?: string
    incoming?: boolean
  }
  | { phase: 'release'; transactionId: string }

export interface TabTransferReply {
  transactionId: string
  ok: boolean
  runtime?: TabRuntimeState
}

export interface TabTransferTarget {
  id: string
  title: string
}

export interface TabTransferInvokeChannels {
  'mt::tabs::transfer-targets': { args: []; ret: TabTransferTarget[] }
  'mt::tabs::move': { args: [documentId: string, targetId: string | null]; ret: void }
  'mt::tabs::begin-drag': { args: [documentId: string]; ret: boolean }
  'mt::tabs::finish-drag': { args: [cancel: boolean]; ret: void }
}
export interface TabTransferSendChannels {
  'mt::tabs::strip': [geometry: TabStripGeometry | null]
  'mt::tabs::reply': [reply: TabTransferReply]
}
export interface TabTransferMainEvents {
  'mt::tabs::transaction': [request: TabTransferRequest]
  'mt::tabs::drag-position': [position: { beforeId: string | null } | null]
  'mt::tabs::transfer-failed': [reason: 'duplicate' | 'failed']
}
