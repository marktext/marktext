import type {
  DiscardedRecoveryRecord,
  DocumentSnapshot,
  DirtyContentUpdate,
  RecoveryRecord,
  RendererDocumentCheckpoint
} from '@shared/types/applicationState'
import type { DiskBaseline } from '@shared/types/files'
import { parseDocument, validIdentity } from './codec'
import { RecoveryStatus } from '@shared/types/applicationState'
import { contentSha256 } from 'common/filesystem'

/** Last verified disk content after editor newline and encoding normalization. */
interface SavedDocument {
  snapshot: DocumentSnapshot
  textHash: string
}

/** Live contents survive failed persistence; pending records are retried before metadata. */
interface DocumentEntry {
  ownerWindowId: string
  snapshot: DocumentSnapshot
  markdown: string
  // Changes only with content or save-format edits.
  revision: number
  // Also invalidates prepared updates after saves, relocations, and disk observations.
  generation: number
  saved: SavedDocument | null
  // Original format of a new blank document, used to recognize undo back to empty.
  emptyFormat: DocumentSnapshot['saveFormat']
  baseline: DiskBaseline | null
  pending: RecoveryRecord['status'] | null
  closed: boolean
}

/** Disk observations and content revision supplied by the trusted native document loader. */
export interface DocumentRegistration {
  contentRevision?: number
  // Required for restored named drafts; may differ from the currently observed saved file.
  baseline?: DiskBaseline | null
  // Current verified disk content, used to recognize undo without replacing the original baseline.
  saved?: { snapshot: DocumentSnapshot; markdown: string }
}

/** Valid only until another accepted operation changes the document generation. */
interface PreparedDocumentUpdate {
  readonly id: string
  readonly generation: number
  readonly entry: DocumentEntry
}

const sameFormat = (
  a: DocumentSnapshot['saveFormat'],
  b: DocumentSnapshot['saveFormat']
): boolean =>
  a.encoding.encoding === b.encoding.encoding &&
  a.encoding.isBom === b.encoding.isBom &&
  a.lineEnding === b.lineEnding &&
  a.adjustLineEndingOnSave === b.adjustLineEndingOnSave &&
  a.trimTrailingNewline === b.trimTrailingNewline

const checkedDocument = (snapshot: DocumentSnapshot): DocumentSnapshot => {
  const parsed = parseDocument(snapshot)
  if (!parsed) throw new Error('Invalid document')
  return structuredClone(parsed)
}

/** Main-process authority for document identity, live text and verified disk baselines. */
export class DocumentRegistry {
  private readonly _entries = new Map<string, DocumentEntry>()

  register(
    ownerWindowId: string,
    snapshot: DocumentSnapshot,
    markdown: string,
    options: DocumentRegistration = {}
  ): void {
    const document = checkedDocument(snapshot)
    if (
      !validIdentity(ownerWindowId) ||
      this._entries.has(document.id) ||
      typeof markdown !== 'string'
    )
      throw new Error('Invalid document registration')
    const revision =
      options.contentRevision ??
      (document.content.kind === 'recovery' ? document.content.contentRevision : 0)
    if (
      !Number.isSafeInteger(revision) ||
      revision < 0 ||
      (document.content.kind === 'recovery' && revision !== document.content.contentRevision)
    )
      throw new Error('Invalid content revision')
    if (
      document.content.kind === 'empty' &&
      (markdown !== '' || (document.resource.kind === 'file' && !document.resource.pendingCreation))
    )
      throw new Error('Invalid empty document')
    let saved: SavedDocument | null = null
    if (document.content.kind === 'disk') {
      saved = { snapshot: structuredClone(document), textHash: contentSha256(markdown) }
    } else if (options.saved) {
      const baseline = checkedDocument(options.saved.snapshot)
      if (baseline.id !== document.id || baseline.content.kind !== 'disk')
        throw new Error('Invalid saved document')
      saved = { snapshot: baseline, textHash: contentSha256(options.saved.markdown) }
    }
    const baseline =
      document.content.kind === 'disk'
        ? document.content.baseline
        : (options.baseline ??
          (document.resource.kind === 'file' && document.resource.pendingCreation
            ? { exists: false }
            : null))
    if (document.content.kind === 'recovery' && document.resource.kind === 'file' && !baseline)
      throw new Error('Missing original disk baseline')
    this._entries.set(document.id, {
      ownerWindowId,
      snapshot: document,
      markdown,
      revision,
      generation: 0,
      saved,
      emptyFormat: structuredClone(document.saveFormat),
      baseline: structuredClone(baseline),
      pending: document.content.kind === 'recovery' ? RecoveryStatus.DIRTY : null,
      closed: false
    })
  }

  private _entry(id: string): DocumentEntry {
    const entry = this._entries.get(id)
    if (!entry) throw new Error('Unknown document')
    if (entry.closed) throw new Error('Document is closed')
    return entry
  }

  get(id: string): DocumentSnapshot {
    return structuredClone(this._entry(id).snapshot)
  }

  text(id: string): string {
    return this._entry(id).markdown
  }

  revision(id: string): number {
    return this._entry(id).revision
  }

  baseline(id: string): DiskBaseline | null {
    return structuredClone(this._entry(id).baseline)
  }

  ownedDocuments(windowId: string): DocumentSnapshot[] {
    return [...this._entries.values()]
      .filter((entry) => entry.ownerWindowId === windowId && !entry.closed)
      .map((entry) => structuredClone(entry.snapshot))
  }

  prepare(
    ownerWindowId: string,
    metadata: RendererDocumentCheckpoint,
    update?: DirtyContentUpdate
  ): PreparedDocumentUpdate {
    const current = this._entry(metadata.id)
    if (current.ownerWindowId !== ownerWindowId) throw new Error('Invalid document owner')
    const snapshot = checkedDocument({
      ...current.snapshot,
      ...metadata,
      resource: current.snapshot.resource,
      title: current.snapshot.title
    })
    const revision = update?.contentRevision ?? current.revision
    const markdown = update?.markdown ?? current.markdown
    if (
      (update && (update.documentId !== metadata.id || typeof update.markdown !== 'string')) ||
      !Number.isSafeInteger(revision) ||
      revision < current.revision ||
      (snapshot.content.kind === 'recovery' && snapshot.content.contentRevision !== revision)
    )
      throw new Error('Invalid content revision')
    const changed =
      markdown !== current.markdown || !sameFormat(snapshot.saveFormat, current.snapshot.saveFormat)
    if (changed && revision === current.revision)
      throw new Error('Content changed without a new revision')
    const matchesSaved =
      current.saved !== null &&
      contentSha256(markdown) === current.saved.textHash &&
      sameFormat(snapshot.saveFormat, current.saved.snapshot.saveFormat)
    const matchesEmpty =
      !current.saved &&
      (snapshot.resource.kind === 'untitled' || snapshot.resource.pendingCreation) &&
      markdown === '' &&
      sameFormat(snapshot.saveFormat, current.emptyFormat)
    if (snapshot.content.kind !== 'recovery' && !matchesSaved && !matchesEmpty)
      throw new Error('Clean content does not match saved content')
    const entry = structuredClone(current)
    snapshot.content =
      matchesSaved && current.saved
        ? structuredClone(current.saved.snapshot.content)
        : matchesEmpty
          ? { kind: 'empty' }
          : { kind: 'recovery', contentRevision: revision }
    entry.snapshot = snapshot
    entry.markdown = markdown
    entry.revision = revision
    entry.generation++
    if (snapshot.content.kind === 'recovery' && (changed || revision !== current.revision))
      entry.pending = RecoveryStatus.DIRTY
    else if (
      snapshot.content.kind !== 'recovery' &&
      (current.pending !== null || current.snapshot.content.kind === 'recovery')
    ) {
      entry.pending = snapshot.content.kind === 'disk' ? RecoveryStatus.SAVED : RecoveryStatus.DISCARDED
    }
    return { id: snapshot.id, generation: current.generation, entry }
  }

  /** Prepare every member before applying a checkpoint; invalid batches have no partial effects. */
  apply(updates: PreparedDocumentUpdate[]): void {
    const seen = new Set<string>()
    for (const update of updates) {
      if (seen.has(update.id) || this._entry(update.id).generation !== update.generation)
        throw new Error('Stale or duplicate prepared document')
      seen.add(update.id)
    }
    for (const update of updates) this._entries.set(update.id, structuredClone(update.entry))
  }

  markSaved(id: string, savedRevision: number, snapshot: DocumentSnapshot, markdown: string): void {
    const current = this._entry(id)
    const saved = checkedDocument(snapshot)
    if (
      saved.id !== id ||
      saved.content.kind !== 'disk' ||
      !Number.isSafeInteger(savedRevision) ||
      savedRevision < 0 ||
      savedRevision > current.revision
    )
      throw new Error('Invalid saved document revision')
    current.saved = { snapshot: saved, textHash: contentSha256(markdown) }
    current.baseline = structuredClone(saved.content.baseline)
    const clean =
      contentSha256(current.markdown) === current.saved.textHash &&
      sameFormat(current.snapshot.saveFormat, saved.saveFormat)
    current.snapshot = {
      ...current.snapshot,
      title: saved.title,
      resource: saved.resource,
      content: clean ? saved.content : { kind: 'recovery', contentRevision: current.revision }
    }
    current.pending = clean ? RecoveryStatus.SAVED : RecoveryStatus.DIRTY
    current.generation++
  }

  savedDocuments(): Map<string, DocumentSnapshot> {
    return new Map(
      [...this._entries].flatMap(([id, entry]) =>
        entry.saved && !entry.closed ? [[id, structuredClone(entry.saved.snapshot)] as const] : []
      )
    )
  }

  prepareClose(id: string, discard: boolean, now: number): DiscardedRecoveryRecord {
    const entry = this._entry(id)
    if (!discard && entry.snapshot.content.kind === 'recovery')
      throw new Error('Cannot close unsaved document')
    return {
      schemaVersion: 1,
      status: RecoveryStatus.DISCARDED,
      ownerWindowId: entry.ownerWindowId,
      documentId: id,
      contentRevision: entry.revision,
      updatedAtMs: now
    }
  }

  requireRecoveryWrite(id: string): void {
    const entry = this._entry(id)
    entry.pending =
      entry.snapshot.content.kind === 'recovery'
        ? RecoveryStatus.DIRTY
        : entry.snapshot.content.kind === 'disk'
          ? RecoveryStatus.SAVED
          : RecoveryStatus.DISCARDED
  }

  discard(id: string): void {
    const entry = this._entry(id)
    entry.closed = true
    entry.pending = RecoveryStatus.DISCARDED
    entry.generation++
  }

  pendingRecords(now: number): RecoveryRecord[] {
    return [...this._entries.values()].flatMap((entry): RecoveryRecord[] => {
      const common = {
        schemaVersion: 1,
        ownerWindowId: entry.ownerWindowId,
        documentId: entry.snapshot.id,
        contentRevision: entry.revision,
        updatedAtMs: now
      } as const
      if (entry.pending === RecoveryStatus.DISCARDED) return [{ ...common, status: RecoveryStatus.DISCARDED }]
      if (entry.pending === RecoveryStatus.SAVED)
        return [{ ...common, status: RecoveryStatus.SAVED, document: structuredClone(entry.snapshot) }]
      if (entry.pending === RecoveryStatus.DIRTY)
        return [
          {
            ...common,
            status: RecoveryStatus.DIRTY,
            document: structuredClone(entry.snapshot),
            markdown: entry.markdown,
            contentSha256: contentSha256(entry.markdown),
            baseline: structuredClone(entry.baseline)
          }
        ]
      return []
    })
  }

  settle(record: RecoveryRecord): void {
    const entry = this._entries.get(record.documentId)
    if (!entry || entry.revision !== record.contentRevision || entry.pending !== record.status)
      return
    if (entry.closed) this._entries.delete(record.documentId)
    else entry.pending = null
  }

  releaseWindow(windowId: string): void {
    const entries = [...this._entries].filter(([, entry]) => entry.ownerWindowId === windowId)
    if (entries.some(([, entry]) => !entry.closed && entry.snapshot.content.kind === 'recovery'))
      throw new Error('Cannot release unsaved window contents')
    for (const [id, entry] of entries) {
      if (entry.pending === null) this._entries.delete(id)
      else entry.closed = true
    }
  }
}
