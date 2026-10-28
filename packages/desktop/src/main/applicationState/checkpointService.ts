import { rememberWindowContext } from '@shared/applicationState/workspaceRecents'
import { RecoveryStatus, SessionLifecycle } from '@shared/types/applicationState'
import type {
  ApplicationState,
  ApplicationStateStorage,
  DiscardedRecoveryRecord,
  DocumentRecoveryStorage,
  DocumentSnapshot,
  PersistResult,
  RuntimeWindowContext,
  WindowCheckpointRequest,
  WindowInitialization,
  WindowSnapshot,
  DocumentRegistration,
  RegisteredDocumentContent
} from '@shared/types/applicationState'
import type { DiskBaseline } from '@shared/types/files'
import { parseWindowSnapshot } from './codec'
import { DocumentRegistry } from './documentRegistry'
import { createStateId } from './identity'
import { contentSha256 } from 'common/filesystem'

/** Per-renderer request ordering and the receipt cached for an identical retry. */
interface RendererContext {
  token: string
  sequence: number
  // Hash of the accepted request, including layout and body updates.
  digest: string | null
  result: PersistResult | null
  closeTransactionId: string | null
}

/** Immutable input to one disk save; later typing must remain independent of its result. */
interface SaveCapture {
  snapshot: DocumentSnapshot
  markdown: string
  contentRevision: number
  baseline: DiskBaseline | null
}

type SaveDocumentResult = PersistResult | { status: 'cancelled' }
type RendererInitialization = Omit<WindowInitialization, 'preferences'>

const failed = (): PersistResult => ({ status: 'failed', reason: 'storage-unavailable' })

/** Serializes all application metadata changes; disk saves run outside the checkpoint queue. */
export class CheckpointService {
  private _state: ApplicationState
  private readonly _documents = new DocumentRegistry()
  private readonly _contexts = new Map<string, RendererContext>()
  private readonly _saveQueues = new Map<string, Promise<unknown>>()
  private _tail: Promise<unknown> = Promise.resolve()

  constructor(
    initial: ApplicationState,
    private readonly _metadata: ApplicationStateStorage,
    private readonly _recovery: DocumentRecoveryStorage,
    private readonly _now: () => number = Date.now,
    private readonly _onCleanupError: (error: unknown) => void = () => {}
  ) {
    this._state = structuredClone(initial)
  }

  private _enqueue<T>(operation: () => Promise<T> | T): Promise<T> {
    const result = this._tail.then(operation)
    this._tail = result.catch(() => {})
    return result
  }

  getState(): ApplicationState {
    return structuredClone(this._state)
  }

  getWindow(id: string): WindowSnapshot | null {
    return structuredClone(this._state.session.windows.find((window) => window.id === id) ?? null)
  }

  getDocument(id: string): DocumentSnapshot {
    return this._documents.get(id)
  }

  hasPendingSave(documentId: string): boolean {
    return this._saveQueues.has(documentId)
  }

  async settlePendingSaves(documentIds: string[]): Promise<void> {
    await Promise.allSettled(documentIds.map((id) => this._saveQueues.get(id)))
  }

  /** The host must flush a new window's membership before allowing edits in its renderer. */
  attachWindow(
    snapshot: WindowSnapshot,
    contents: RegisteredDocumentContent[]
  ): Promise<RuntimeWindowContext> {
    const window = structuredClone(snapshot)
    const bodies = structuredClone(contents)
    return this._enqueue(() => {
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
          this._state.session.windows.some((existing) =>
            existing.documents.some((item) => item.id === document.id && existing.id !== parsed.id)
          )
        )
          throw new Error('Invalid document owner')
      }
      if (this._contexts.has(parsed.id)) throw new Error('Window already attached')
      for (const document of parsed.documents) {
        const body = bodies.find((body) => body.documentId === document.id)
        if (!body) throw new Error('Missing document content')
        this._documents.register(parsed.id, document, body.markdown, body)
      }
      const index = this._state.session.windows.findIndex((entry) => entry.id === parsed.id)
      if (index < 0) this._state.session.windows.push(parsed)
      else this._state.session.windows[index] = parsed
      this._state.session.lastWindow = null
      this._state.session.activeWindowId ??= parsed.id
      return this._rotateContext(parsed.id)
    })
  }

  private _rotateContext(windowId: string): RuntimeWindowContext {
    const token = createStateId()
    this._contexts.set(windowId, {
      token,
      sequence: 0,
      digest: null,
      result: null,
      closeTransactionId: null
    })
    return { contextToken: token }
  }

  initializeRenderer(windowId: string): Promise<RendererInitialization> {
    return this._enqueue(() => {
      const snapshot = this.getWindow(windowId)
      if (!snapshot || !this._contexts.has(windowId)) throw new Error('Unknown window')
      return {
        context: this._rotateContext(windowId),
        snapshot,
        documentContents: snapshot.documents.map((document) => ({
          documentId: document.id,
          contentRevision: this._documents.revision(document.id),
          markdown: this._documents.text(document.id)
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
    return this._enqueue(async() => {
      const context = this._contexts.get(windowId)
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
        const owned = this._documents.ownedDocuments(windowId)
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
          this._documents.prepare(windowId, document, bodies.get(document.id))
        )
        const parsed = parseWindowSnapshot({
          ...snapshot,
          layout: captured.layout,
          projectView: captured.projectView,
          documents: updates.map((update) => update.entry.snapshot),
          activeDocumentId: captured.activeDocumentId,
          updatedAtMs: this._now()
        })
        if (!parsed) throw new Error('Invalid checkpoint snapshot')
        this._documents.apply(updates)
        this._replaceWindow(parsed)
      } catch {
        return { status: 'failed', reason: 'invalid-data' }
      }
      context.sequence = captured.sequence
      context.digest = digest
      const result = await this._persistResult(windowId)
      context.result = result
      return result
    })
  }

  flush(windowId: string, token: string): Promise<PersistResult> {
    return this._enqueue(async() => {
      const context = this._contexts.get(windowId)
      if (!this.getWindow(windowId) || !context || context.token !== token)
        return { status: 'failed', reason: 'stale-context' }
      return this._persistResult(windowId)
    })
  }

  beginCloseCheckpoint(windowId: string, transactionId: string): Promise<void> {
    return this._enqueue(() => {
      const context = this._contexts.get(windowId)
      if (!context || !this.getWindow(windowId) || !transactionId)
        throw new Error('Invalid close transaction')
      context.closeTransactionId = transactionId
    })
  }

  cancelCloseCheckpoint(windowId: string, transactionId: string): Promise<void> {
    return this._enqueue(() => {
      const context = this._contexts.get(windowId)
      if (context?.closeTransactionId === transactionId) context.closeTransactionId = null
    })
  }

  private _replaceWindow(snapshot: WindowSnapshot): void {
    const index = this._state.session.windows.findIndex((window) => window.id === snapshot.id)
    if (index < 0) throw new Error('Unknown window')
    this._state.session.windows[index] = snapshot
  }

  private _refreshDocuments(windowId: string): void {
    const snapshot = this.getWindow(windowId)
    if (!snapshot) throw new Error('Unknown window')
    const remaining = new Map(
      this._documents.ownedDocuments(windowId).map((document) => [document.id, document])
    )
    snapshot.documents = snapshot.documents.flatMap((document) => {
      const current = remaining.get(document.id)
      remaining.delete(document.id)
      return current ? [current] : []
    })
    snapshot.documents.push(...remaining.values())
    if (!snapshot.documents.some((document) => document.id === snapshot.activeDocumentId))
      snapshot.activeDocumentId = snapshot.documents[0]?.id ?? null
    snapshot.updatedAtMs = this._now()
    this._replaceWindow(snapshot)
  }

  addDocument(
    windowId: string,
    snapshot: DocumentSnapshot,
    markdown: string,
    options: DocumentRegistration = {}
  ): Promise<PersistResult> {
    const document = structuredClone(snapshot)
    const registration = structuredClone(options)
    return this._enqueue(async() => {
      const context = this._contexts.get(windowId)
      if (!this.getWindow(windowId) || !context) throw new Error('Unknown window')
      this._documents.register(windowId, document, markdown, registration)
      this._refreshDocuments(windowId)
      return this._persistResult(windowId)
    })
  }

  endDocument(windowId: string, documentId: string, discard: boolean): Promise<PersistResult> {
    return this._enqueue(async() => {
      const snapshot = this.getWindow(windowId)
      if (!snapshot?.documents.some((document) => document.id === documentId))
        return { status: 'failed', reason: 'invalid-data' }
      if (this._saveQueues.has(documentId)) return failed()
      const marker = this._documents.prepareClose(documentId, discard, this._now())
      snapshot.documents = snapshot.documents.filter((document) => document.id !== documentId)
      if (snapshot.activeDocumentId === documentId)
        snapshot.activeDocumentId = snapshot.documents[0]?.id ?? null
      const candidate = this.getState()
      candidate.session.windows = candidate.session.windows.map((window) =>
        window.id === windowId ? snapshot : window
      )
      try {
        await this._persist(candidate, [marker])
        return this._receipt(windowId)
      } catch {
        this._documents.requireRecoveryWrite(documentId)
        return failed()
      }
    })
  }

  relocateDocument(
    windowId: string,
    documentId: string,
    location: Extract<DocumentSnapshot['resource'], { kind: 'file' }>['location'],
    title: string
  ): Promise<PersistResult> {
    const captured = structuredClone(location)
    return this._enqueue(async() => {
      if (
        !this.getWindow(windowId)?.documents.some((document) => document.id === documentId) ||
        this._saveQueues.has(documentId)
      )
        throw new Error('Document cannot be relocated while saving')
      this._documents.relocate(documentId, captured, title)
      this._refreshDocuments(windowId)
      return this._persistResult(windowId)
    })
  }

  observeDisk(
    windowId: string,
    documentId: string,
    snapshot: DocumentSnapshot | null,
    markdown = ''
  ): Promise<PersistResult> {
    const captured = snapshot ? structuredClone(snapshot) : null
    return this._enqueue(async() => {
      if (!this.getWindow(windowId)?.documents.some((document) => document.id === documentId))
        return { status: 'failed', reason: 'invalid-data' }
      this._documents.observeDisk(documentId, captured, markdown)
      this._refreshDocuments(windowId)
      return this._persistResult(windowId)
    })
  }

  saveDocument(
    windowId: string,
    documentId: string,
    write: (
      capture: SaveCapture
    ) => Promise<{ snapshot: DocumentSnapshot; markdown: string } | null>
  ): Promise<SaveDocumentResult> {
    const previous = this._saveQueues.get(documentId) ?? Promise.resolve()
    const operation = previous
      .catch(() => {})
      .then(async(): Promise<SaveDocumentResult> => {
        const capture = await this._enqueue((): SaveCapture => {
          if (!this.getWindow(windowId)?.documents.some((document) => document.id === documentId))
            throw new Error('Invalid document owner')
          return {
            snapshot: this._documents.get(documentId),
            markdown: this._documents.text(documentId),
            contentRevision: this._documents.revision(documentId),
            baseline: this._documents.baseline(documentId)
          }
        })
        const revision = capture.contentRevision
        const saved = structuredClone(await write(capture))
        if (saved === null) return { status: 'cancelled' }
        return this._enqueue(async() => {
          this._documents.markSaved(documentId, revision, saved.snapshot, saved.markdown)
          this._refreshDocuments(windowId)
          return this._persistResult(windowId)
        })
      })
    this._saveQueues.set(documentId, operation)
    const cleanup = (): void => {
      if (this._saveQueues.get(documentId) === operation) this._saveQueues.delete(documentId)
    }
    void operation.then(cleanup, cleanup)
    return operation
  }

  /** Membership changes become visible only after the complete durable commit succeeds. */
  commitState(transform: (state: ApplicationState) => ApplicationState): Promise<void> {
    return this._enqueue(async() => {
      const candidate = structuredClone(transform(this.getState()))
      const previous = this._state
      const liveIds = new Set(candidate.session.windows.map((window) => window.id))
      if (candidate.session.lifecycle === SessionLifecycle.CLOSED && this._saveQueues.size > 0)
        throw new Error('Cannot finish session with pending saves')
      for (const window of this._state.session.windows) {
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
            window.documents.some((document) => this._saveQueues.has(document.id)))
        )
          throw new Error('Cannot remove a window with unsaved documents or pending saves')
      }
      await this._persist(candidate)
      for (const id of this._contexts.keys()) {
        if (!liveIds.has(id)) {
          this._documents.releaseWindow(id)
          this._contexts.delete(id)
        } else if (
          candidate.session.id !== previous.session.id ||
          JSON.stringify(
            candidate.session.windows.find((window) => window.id === id)?.workspace
          ) !==
            JSON.stringify(previous.session.windows.find((window) => window.id === id)?.workspace)
        )
          this._rotateContext(id)
      }
    })
  }

  private async _persistResult(windowId: string): Promise<PersistResult> {
    try {
      await this._persist(this._state)
      return this._receipt(windowId)
    } catch {
      return failed()
    }
  }

  private _receipt(windowId: string): PersistResult {
    return {
      status: 'persisted',
      receipt: {
        metadataRevision: this._state.revision,
        documents: this.getWindow(windowId)?.documents ?? []
      }
    }
  }

  private async _persist(
    candidate: ApplicationState,
    ended: DiscardedRecoveryRecord[] = []
  ): Promise<void> {
    const recordsById = new Map(
      this._documents.pendingRecords(this._now()).map((record) => [record.documentId, record])
    )
    for (const record of ended) recordsById.set(record.documentId, record)
    const records = [...recordsById.values()]
    for (const record of records) await this._recovery.write(record)
    const savedDocuments = this._documents.savedDocuments()
    let remembered = structuredClone(candidate)
    for (const window of this._state.session.windows) {
      if (!candidate.session.windows.some((current) => current.id === window.id))
        remembered = rememberWindowContext(remembered, window, { savedDocuments })
    }
    const windows = [...candidate.session.windows].sort(
      (a, b) =>
        Number(a.id === candidate.session.activeWindowId) -
        Number(b.id === candidate.session.activeWindowId)
    )
    for (const window of windows)
      remembered = rememberWindowContext(remembered, window, { savedDocuments })
    if (candidate.session.lastWindow)
      remembered = rememberWindowContext(
        {
          ...remembered,
          session: { ...remembered.session, activeWindowId: candidate.session.lastWindow.id }
        },
        candidate.session.lastWindow,
        { savedDocuments }
      )
    remembered.session = candidate.session
    const next = {
      ...remembered,
      revision: this._state.revision + 1,
      updatedAtMs: this._now()
    }
    await this._metadata.write(next)
    this._state = next
    for (const record of ended) this._documents.discard(record.documentId)
    for (const record of records) {
      if (record.status !== RecoveryStatus.DIRTY) {
        try {
          await this._recovery.remove(record.ownerWindowId, record.documentId)
        } catch (error) {
          try {
            this._onCleanupError(error)
          } catch {
            // Reporting cannot invalidate a completed metadata commit.
          }
          continue
        }
      }
      this._documents.settle(record)
    }
  }
}
