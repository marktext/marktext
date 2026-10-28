import type { DocumentRegistration } from '@shared/types/applicationState'
import type {
  DiskBaseline,
  DiscardedRecoveryRecord,
  DocumentSnapshot,
  DirtyContentUpdate,
  RecoveryRecord,
  RendererDocumentCheckpoint
} from '@shared/types/applicationState'
import { parseDocument, validIdentity } from './codec'
import { contentSha256 } from 'common/filesystem'

interface SavedDocument {
  snapshot: DocumentSnapshot
  textHash: string
}

interface DocumentEntry {
  ownerWindowId: string
  snapshot: DocumentSnapshot
  markdown: string
  revision: number
  generation: number
  saved: SavedDocument | null
  emptyFormat: DocumentSnapshot['saveFormat']
  baseline: DiskBaseline | null
  pending: RecoveryRecord['status'] | null
  closed: boolean
}

export interface PreparedDocumentUpdate {
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
  private readonly entries = new Map<string, DocumentEntry>()

  register(
    ownerWindowId: string,
    snapshot: DocumentSnapshot,
    markdown: string,
    options: DocumentRegistration = {}
  ): void {
    const document = checkedDocument(snapshot)
    if (
      !validIdentity(ownerWindowId) ||
      this.entries.has(document.id) ||
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
    this.entries.set(document.id, {
      ownerWindowId,
      snapshot: document,
      markdown,
      revision,
      generation: 0,
      saved,
      emptyFormat: structuredClone(document.saveFormat),
      baseline: structuredClone(baseline),
      pending: document.content.kind === 'recovery' ? 'dirty' : null,
      closed: false
    })
  }

  private entry(id: string): DocumentEntry {
    const entry = this.entries.get(id)
    if (!entry) throw new Error('Unknown document')
    if (entry.closed) throw new Error('Document is closed')
    return entry
  }

  get(id: string): DocumentSnapshot {
    return structuredClone(this.entry(id).snapshot)
  }

  text(id: string): string {
    return this.entry(id).markdown
  }

  revision(id: string): number {
    return this.entry(id).revision
  }

  baseline(id: string): DiskBaseline | null {
    return structuredClone(this.entry(id).baseline)
  }

  ownedDocuments(windowId: string): DocumentSnapshot[] {
    return [...this.entries.values()]
      .filter((entry) => entry.ownerWindowId === windowId && !entry.closed)
      .map((entry) => structuredClone(entry.snapshot))
  }

  prepare(
    ownerWindowId: string,
    metadata: RendererDocumentCheckpoint,
    update?: DirtyContentUpdate
  ): PreparedDocumentUpdate {
    const current = this.entry(metadata.id)
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
      !current.saved && markdown === '' && sameFormat(snapshot.saveFormat, current.emptyFormat)
    if (snapshot.content.kind !== 'recovery' && !matchesSaved && !matchesEmpty)
      throw new Error('Clean content does not match saved content')
    const entry = structuredClone(current)
    snapshot.content =
      matchesSaved && current.saved
        ? structuredClone(current.saved.snapshot.content)
        : matchesEmpty
          ? { kind: 'empty' }
          : { kind: 'recovery', contentRevision: revision }
    if (matchesSaved && current.saved?.snapshot.content.kind === 'disk') {
      snapshot.resource = structuredClone(current.saved.snapshot.resource)
      entry.baseline = structuredClone(current.saved.snapshot.content.baseline)
    }
    const observed = current.saved?.snapshot.content
    const acceptsObserved =
      observed?.kind === 'disk' &&
      observed.baseline.exists &&
      metadata.acceptedDiskSha256 === observed.baseline.rawSha256
    const baselineChanged =
      acceptsObserved && JSON.stringify(entry.baseline) !== JSON.stringify(observed.baseline)
    if (acceptsObserved) entry.baseline = structuredClone(observed.baseline)
    entry.snapshot = snapshot
    entry.markdown = markdown
    entry.revision = revision
    entry.generation++
    if (
      snapshot.content.kind === 'recovery' &&
      (changed ||
        baselineChanged ||
        revision !== current.revision ||
        current.snapshot.content.kind !== 'recovery')
    )
      entry.pending = 'dirty'
    else if (
      snapshot.content.kind !== 'recovery' &&
      (current.pending !== null || current.snapshot.content.kind === 'recovery')
    ) {
      entry.pending = snapshot.content.kind === 'disk' ? 'saved' : 'discarded'
    }
    return { id: snapshot.id, generation: current.generation, entry }
  }

  /** Prepare every member before applying a checkpoint; invalid batches have no partial effects. */
  apply(updates: PreparedDocumentUpdate[]): void {
    const seen = new Set<string>()
    for (const update of updates) {
      if (seen.has(update.id) || this.entry(update.id).generation !== update.generation)
        throw new Error('Stale or duplicate prepared document')
      seen.add(update.id)
    }
    for (const update of updates) this.entries.set(update.id, structuredClone(update.entry))
  }

  markSaved(id: string, savedRevision: number, snapshot: DocumentSnapshot, markdown: string): void {
    const current = this.entry(id)
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
    current.pending = clean ? 'saved' : 'dirty'
    current.generation++
  }

  relocate(
    id: string,
    location: Extract<DocumentSnapshot['resource'], { kind: 'file' }>['location'],
    title: string
  ): void {
    const entry = this.entry(id)
    if (entry.snapshot.resource.kind !== 'file')
      throw new Error('Cannot relocate an untitled document')
    const resource = { ...entry.snapshot.resource, location: structuredClone(location) }
    entry.snapshot = checkedDocument({ ...entry.snapshot, resource, title })
    if (entry.saved)
      entry.saved.snapshot = checkedDocument({ ...entry.saved.snapshot, resource, title })
    entry.pending =
      entry.snapshot.content.kind === 'recovery'
        ? 'dirty'
        : entry.snapshot.content.kind === 'disk'
          ? 'saved'
          : 'discarded'
    entry.generation++
  }

  observeDisk(id: string, snapshot: DocumentSnapshot | null, markdown = ''): void {
    const entry = this.entry(id)
    if (snapshot === null) {
      entry.saved = null
      entry.snapshot.content = { kind: 'recovery', contentRevision: entry.revision }
      entry.pending = 'dirty'
    } else {
      const saved = checkedDocument(snapshot)
      if (saved.id !== id || saved.content.kind !== 'disk')
        throw new Error('Invalid observed disk document')
      entry.saved = { snapshot: saved, textHash: contentSha256(markdown) }
      if (entry.markdown === markdown && sameFormat(entry.snapshot.saveFormat, saved.saveFormat)) {
        entry.snapshot.content = saved.content
        entry.snapshot.resource = saved.resource
        entry.baseline = structuredClone(saved.content.baseline)
        entry.pending = 'saved'
      }
    }
    entry.generation++
  }

  savedDocuments(): Map<string, DocumentSnapshot> {
    return new Map(
      [...this.entries].flatMap(([id, entry]) =>
        entry.saved && !entry.closed ? [[id, structuredClone(entry.saved.snapshot)] as const] : []
      )
    )
  }

  close(id: string): void {
    const entry = this.entry(id)
    if (entry.snapshot.content.kind === 'recovery') throw new Error('Cannot close unsaved document')
    this.discard(id)
  }

  prepareClose(id: string, discard: boolean, now: number): DiscardedRecoveryRecord {
    const entry = this.entry(id)
    if (!discard && entry.snapshot.content.kind === 'recovery')
      throw new Error('Cannot close unsaved document')
    return {
      schemaVersion: 1,
      status: 'discarded',
      ownerWindowId: entry.ownerWindowId,
      documentId: id,
      contentRevision: entry.revision,
      updatedAtMs: now
    }
  }

  requireRecoveryWrite(id: string): void {
    const entry = this.entry(id)
    entry.pending =
      entry.snapshot.content.kind === 'recovery'
        ? 'dirty'
        : entry.snapshot.content.kind === 'disk'
          ? 'saved'
          : 'discarded'
  }

  discard(id: string): void {
    const entry = this.entry(id)
    entry.closed = true
    entry.markdown = ''
    entry.pending = 'discarded'
    entry.generation++
  }

  pendingRecords(now: number): RecoveryRecord[] {
    return [...this.entries.values()].flatMap((entry): RecoveryRecord[] => {
      const common = {
        schemaVersion: 1,
        ownerWindowId: entry.ownerWindowId,
        documentId: entry.snapshot.id,
        contentRevision: entry.revision,
        updatedAtMs: now
      } as const
      if (entry.pending === 'discarded') return [{ ...common, status: 'discarded' }]
      if (entry.pending === 'saved')
        return [{ ...common, status: 'saved', document: structuredClone(entry.snapshot) }]
      if (entry.pending === 'dirty')
        return [
          {
            ...common,
            status: 'dirty',
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
    const entry = this.entries.get(record.documentId)
    if (!entry || entry.revision !== record.contentRevision || entry.pending !== record.status)
      return
    if (entry.closed) this.entries.delete(record.documentId)
    else entry.pending = null
  }

  releaseWindow(windowId: string): void {
    const entries = [...this.entries].filter(([, entry]) => entry.ownerWindowId === windowId)
    if (entries.some(([, entry]) => !entry.closed && entry.snapshot.content.kind === 'recovery'))
      throw new Error('Cannot release unsaved window contents')
    for (const [id, entry] of entries) {
      if (entry.pending === null) this.entries.delete(id)
      else {
        entry.closed = true
        entry.markdown = ''
      }
    }
  }
}
