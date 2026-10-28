import type {
  ApplicationState,
  ApplicationStateStorage,
  DiskBaseline,
  DiscardedRecoveryRecord,
  DocumentRecoveryStorage,
  DocumentSnapshot,
  PersistResult,
  RuntimeWindowContext,
  WindowCheckpointRequest,
  WindowInitialization,
  WindowSnapshot
} from '@shared/types/applicationState'
import { parseWindowSnapshot } from './codec'
import { DocumentRegistry, type DocumentRegistration } from './documentRegistry'
import { createStateId } from './identity'
import { contentSha256 } from 'common/filesystem'

interface RendererContext {
  token: string
  sequence: number
  digest: string | null
  result: PersistResult | null
  closeTransactionId: string | null
}

export interface RegisteredDocumentContent extends DocumentRegistration {
  documentId: string
  markdown: string
}

export interface SaveCapture {
  snapshot: DocumentSnapshot
  markdown: string
  contentRevision: number
  baseline: DiskBaseline | null
}

export type SaveDocumentResult = PersistResult | { status: 'cancelled' }
type RendererInitialization = Omit<WindowInitialization, 'preferences'>

const failed = (): PersistResult => ({ status: 'failed', reason: 'storage-unavailable' })

/** Serializes all application metadata changes; disk saves run outside the checkpoint queue. */
export class CheckpointService {
  private state: ApplicationState
  private readonly documents = new DocumentRegistry()
  private readonly contexts = new Map<string, RendererContext>()
  private readonly saveQueues = new Map<string, Promise<unknown>>()
  private tail: Promise<unknown> = Promise.resolve()

  constructor(
    initial: ApplicationState,
    private readonly metadata: ApplicationStateStorage,
    private readonly recovery: DocumentRecoveryStorage,
    private readonly now: () => number = Date.now,
    private readonly onCleanupError: (error: unknown) => void = () => {}
  ) {
    this.state = structuredClone(initial)
  }

  private enqueue<T>(operation: () => Promise<T> | T): Promise<T> {
    const result = this.tail.then(operation)
    this.tail = result.catch(() => {})
    return result
  }

  getState(): ApplicationState {
    return structuredClone(this.state)
  }

  getWindow(id: string): WindowSnapshot | null {
    return structuredClone(this.state.session.windows.find((window) => window.id === id) ?? null)
  }

  getDocument(id: string): DocumentSnapshot {
    return this.documents.get(id)
  }

  savedDocuments(): Map<string, DocumentSnapshot> {
    return this.documents.savedDocuments()
  }

  /** The host must flush a new window's membership before allowing edits in its renderer. */
  attachWindow(
    snapshot: WindowSnapshot,
    contents: RegisteredDocumentContent[]
  ): Promise<RuntimeWindowContext> {
    const window = structuredClone(snapshot)
    const bodies = structuredClone(contents)
    return this.enqueue(() => {
      const parsed = parseWindowSnapshot(window)
      if (
        !parsed ||
        parsed.documents.length !== window.documents.length ||
        bodies.length !== window.documents.length ||
        new Set(bodies.map((body) => body.documentId)).size !== bodies.length
      )
        throw new Error('Invalid window registration')
      const validation = new DocumentRegistry()
      for (const document of parsed.documents) {
        const body = bodies.find((body) => body.documentId === document.id)
        if (!body) throw new Error('Missing document content')
        validation.register(parsed.id, document, body.markdown, body)
      }
      for (const document of parsed.documents) {
        if (
          this.state.session.windows.some((existing) =>
            existing.documents.some((item) => item.id === document.id && existing.id !== parsed.id)
          )
        )
          throw new Error('Invalid document owner')
      }
      if (this.contexts.has(parsed.id)) throw new Error('Window already attached')
      for (const document of parsed.documents) {
        const body = bodies.find((body) => body.documentId === document.id)
        if (!body) throw new Error('Missing document content')
        this.documents.register(parsed.id, document, body.markdown, body)
      }
      const index = this.state.session.windows.findIndex((entry) => entry.id === parsed.id)
      if (index < 0) this.state.session.windows.push(parsed)
      else this.state.session.windows[index] = parsed
      this.state.session.lastWindow = null
      this.state.session.activeWindowId ??= parsed.id
      return this.rotateContext(parsed.id)
    })
  }

  private rotateContext(windowId: string): RuntimeWindowContext {
    const token = createStateId()
    this.contexts.set(windowId, {
      token,
      sequence: 0,
      digest: null,
      result: null,
      closeTransactionId: null
    })
    return { windowId, sessionId: this.state.session.id, contextToken: token }
  }

  initializeRenderer(windowId: string): Promise<RendererInitialization> {
    return this.enqueue(() => {
      const snapshot = this.getWindow(windowId)
      if (!snapshot || !this.contexts.has(windowId)) throw new Error('Unknown window')
      return {
        context: this.rotateContext(windowId),
        snapshot,
        documentContents: snapshot.documents.map((document) => ({
          documentId: document.id,
          contentRevision: this.documents.revision(document.id),
          markdown: this.documents.text(document.id)
        }))
      }
    })
  }

  checkpoint(windowId: string, request: WindowCheckpointRequest): Promise<PersistResult> {
    let captured: WindowCheckpointRequest
    let digest: string
    try {
      captured = structuredClone(request)
      if (!captured || typeof captured !== 'object') throw new Error('Invalid checkpoint')
      digest = contentSha256(JSON.stringify(captured))
    } catch {
      return Promise.resolve({ status: 'failed', reason: 'invalid-data' })
    }
    return this.enqueue(async() => {
      const context = this.contexts.get(windowId)
      const snapshot = this.getWindow(windowId)
      if (!snapshot || !context || context.token !== captured.contextToken)
        return { status: 'failed', reason: 'stale-context' }
      if (!Number.isSafeInteger(captured.sequence) || captured.sequence < 1)
        return { status: 'failed', reason: 'invalid-data' }
      if (
        captured.closeTransactionId !== null &&
        captured.closeTransactionId !== context.closeTransactionId
      )
        return { status: 'failed', reason: 'invalid-data' }
      if (
        captured.sequence < context.sequence ||
        (captured.sequence === context.sequence && digest !== context.digest)
      )
        return { status: 'failed', reason: 'stale-sequence' }
      if (captured.sequence === context.sequence && context.result?.status === 'persisted')
        return structuredClone(context.result)
      try {
        if (!Array.isArray(captured.documents) || !Array.isArray(captured.dirtyContents))
          throw new Error('Invalid checkpoint')
        const owned = this.documents.ownedDocuments(windowId)
        const ids = new Set(captured.documents.map((document) => document.id))
        const bodies = new Map(captured.dirtyContents.map((body) => [body.documentId, body]))
        if (
          ids.size !== captured.documents.length ||
          ids.size !== owned.length ||
          owned.some((document) => !ids.has(document.id)) ||
          bodies.size !== captured.dirtyContents.length ||
          [...bodies.keys()].some((id) => !ids.has(id)) ||
          (captured.activeDocumentId !== null && !ids.has(captured.activeDocumentId))
        )
          throw new Error('Invalid checkpoint membership')
        const updates = captured.documents.map((document) =>
          this.documents.prepare(windowId, document, bodies.get(document.id))
        )
        const parsed = parseWindowSnapshot({
          ...snapshot,
          layout: captured.layout,
          projectView: captured.projectView,
          documents: updates.map((update) => update.entry.snapshot),
          activeDocumentId: captured.activeDocumentId,
          updatedAtMs: this.now()
        })
        if (!parsed) throw new Error('Invalid checkpoint snapshot')
        this.documents.apply(updates)
        this.replaceWindow(parsed)
      } catch {
        return { status: 'failed', reason: 'invalid-data' }
      }
      context.sequence = captured.sequence
      context.digest = digest
      const result = await this.persistResult(captured.sequence, windowId)
      context.result = result
      return result
    })
  }

  flush(windowId: string, token: string): Promise<PersistResult> {
    return this.enqueue(async() => {
      const context = this.contexts.get(windowId)
      if (!this.getWindow(windowId) || !context || context.token !== token)
        return { status: 'failed', reason: 'stale-context' }
      return this.persistResult(context.sequence, windowId)
    })
  }

  beginCloseCheckpoint(windowId: string, transactionId: string): Promise<void> {
    return this.enqueue(() => {
      const context = this.contexts.get(windowId)
      if (!context || !this.getWindow(windowId) || !transactionId)
        throw new Error('Invalid close transaction')
      context.closeTransactionId = transactionId
    })
  }

  cancelCloseCheckpoint(windowId: string, transactionId: string): Promise<void> {
    return this.enqueue(() => {
      const context = this.contexts.get(windowId)
      if (context?.closeTransactionId === transactionId) context.closeTransactionId = null
    })
  }

  private replaceWindow(snapshot: WindowSnapshot): void {
    const index = this.state.session.windows.findIndex((window) => window.id === snapshot.id)
    if (index < 0) throw new Error('Unknown window')
    this.state.session.windows[index] = snapshot
  }

  private refreshDocuments(windowId: string): void {
    const snapshot = this.getWindow(windowId)
    if (!snapshot) throw new Error('Unknown window')
    const remaining = new Map(
      this.documents.ownedDocuments(windowId).map((document) => [document.id, document])
    )
    snapshot.documents = snapshot.documents.flatMap((document) => {
      const current = remaining.get(document.id)
      remaining.delete(document.id)
      return current ? [current] : []
    })
    snapshot.documents.push(...remaining.values())
    if (!snapshot.documents.some((document) => document.id === snapshot.activeDocumentId))
      snapshot.activeDocumentId = snapshot.documents[0]?.id ?? null
    snapshot.updatedAtMs = this.now()
    this.replaceWindow(snapshot)
  }

  addDocument(
    windowId: string,
    snapshot: DocumentSnapshot,
    markdown: string,
    options: DocumentRegistration = {}
  ): Promise<PersistResult> {
    const document = structuredClone(snapshot)
    const registration = structuredClone(options)
    return this.enqueue(async() => {
      const context = this.contexts.get(windowId)
      if (!this.getWindow(windowId) || !context) throw new Error('Unknown window')
      this.documents.register(windowId, document, markdown, registration)
      this.refreshDocuments(windowId)
      return this.persistResult(context.sequence, windowId)
    })
  }

  endDocument(windowId: string, documentId: string, discard: boolean): Promise<PersistResult> {
    return this.enqueue(async() => {
      const snapshot = this.getWindow(windowId)
      if (!snapshot?.documents.some((document) => document.id === documentId))
        return { status: 'failed', reason: 'invalid-data' }
      if (this.saveQueues.has(documentId)) return failed()
      const marker = this.documents.prepareClose(documentId, discard, this.now())
      snapshot.documents = snapshot.documents.filter((document) => document.id !== documentId)
      if (snapshot.activeDocumentId === documentId)
        snapshot.activeDocumentId = snapshot.documents[0]?.id ?? null
      const candidate = this.getState()
      candidate.session.windows = candidate.session.windows.map((window) =>
        window.id === windowId ? snapshot : window
      )
      try {
        await this.persist(candidate, [marker])
        return this.receipt(this.contexts.get(windowId)?.sequence ?? 0, windowId)
      } catch {
        this.documents.requireRecoveryWrite(documentId)
        return failed()
      }
    })
  }

  saveDocument(
    windowId: string,
    documentId: string,
    write: (
      capture: SaveCapture
    ) => Promise<{ snapshot: DocumentSnapshot; markdown: string } | null>
  ): Promise<SaveDocumentResult> {
    const previous = this.saveQueues.get(documentId) ?? Promise.resolve()
    const operation = previous
      .catch(() => {})
      .then(async(): Promise<SaveDocumentResult> => {
        const capture = await this.enqueue((): SaveCapture => {
          if (!this.getWindow(windowId)?.documents.some((document) => document.id === documentId))
            throw new Error('Invalid document owner')
          return {
            snapshot: this.documents.get(documentId),
            markdown: this.documents.text(documentId),
            contentRevision: this.documents.revision(documentId),
            baseline: this.documents.baseline(documentId)
          }
        })
        const revision = capture.contentRevision
        const saved = structuredClone(await write(capture))
        if (saved === null) return { status: 'cancelled' }
        return this.enqueue(async() => {
          this.documents.markSaved(documentId, revision, saved.snapshot, saved.markdown)
          this.refreshDocuments(windowId)
          return this.persistResult(this.contexts.get(windowId)?.sequence ?? 0, windowId)
        })
      })
    this.saveQueues.set(documentId, operation)
    const cleanup = (): void => {
      if (this.saveQueues.get(documentId) === operation) this.saveQueues.delete(documentId)
    }
    void operation.then(cleanup, cleanup)
    return operation
  }

  /** Membership changes become visible only after the complete durable commit succeeds. */
  commitState(transform: (state: ApplicationState) => ApplicationState): Promise<void> {
    return this.enqueue(async() => {
      const candidate = structuredClone(transform(this.getState()))
      const previous = this.state
      const liveIds = new Set(candidate.session.windows.map((window) => window.id))
      if (candidate.session.lifecycle === 'closed' && this.saveQueues.size > 0)
        throw new Error('Cannot finish session with pending saves')
      for (const window of this.state.session.windows) {
        const retained = candidate.session.windows.find((entry) => entry.id === window.id)
        if (
          retained &&
          window.documents.some(
            (document) => !retained.documents.some((entry) => entry.id === document.id)
          )
        )
          throw new Error('Document removal requires an explicit end operation')
        if (
          !liveIds.has(window.id) &&
          (window.documents.some((document) => document.content.kind === 'recovery') ||
            window.documents.some((document) => this.saveQueues.has(document.id)))
        )
          throw new Error('Cannot remove a window with unsaved documents or pending saves')
      }
      await this.persist(candidate)
      for (const id of this.contexts.keys()) {
        if (!liveIds.has(id)) {
          this.documents.releaseWindow(id)
          this.contexts.delete(id)
        } else if (
          candidate.session.id !== previous.session.id ||
          JSON.stringify(
            candidate.session.windows.find((window) => window.id === id)?.workspace
          ) !==
            JSON.stringify(previous.session.windows.find((window) => window.id === id)?.workspace)
        )
          this.rotateContext(id)
      }
    })
  }

  private async persistResult(sequence: number, windowId: string): Promise<PersistResult> {
    try {
      await this.persist(this.state)
      return this.receipt(sequence, windowId)
    } catch {
      return failed()
    }
  }

  private receipt(sequence: number, windowId: string): PersistResult {
    const documents = this.getWindow(windowId)?.documents ?? []
    return {
      status: 'persisted',
      receipt: {
        metadataRevision: this.state.revision,
        sequence,
        recoveryRevisions: documents
          .filter((document) => document.content.kind === 'recovery')
          .map((document) => ({
            documentId: document.id,
            contentRevision: this.documents.revision(document.id)
          }))
      }
    }
  }

  private async persist(
    candidate: ApplicationState,
    ended: DiscardedRecoveryRecord[] = []
  ): Promise<void> {
    const recordsById = new Map(
      this.documents.pendingRecords(this.now()).map((record) => [record.documentId, record])
    )
    for (const record of ended) recordsById.set(record.documentId, record)
    const records = [...recordsById.values()]
    for (const record of records) await this.recovery.write(record)
    const next = {
      ...structuredClone(candidate),
      revision: this.state.revision + 1,
      updatedAtMs: this.now()
    }
    await this.metadata.write(next)
    this.state = next
    for (const record of ended) this.documents.discard(record.documentId)
    for (const record of records) {
      if (record.status !== 'dirty') {
        try {
          await this.recovery.remove(record.ownerWindowId, record.documentId)
        } catch (error) {
          try {
            this.onCleanupError(error)
          } catch {
            // Reporting cannot invalidate a completed metadata commit.
          }
          continue
        }
      }
      this.documents.settle(record)
    }
  }
}
