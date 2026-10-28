// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { StorageHooks } from '../../../src/main/applicationState/atomicJsonFile'
import { CheckpointService } from '../../../src/main/applicationState/checkpointService'
import { ApplicationStateStore, RecoveryStore } from '../../../src/main/applicationState/storage'
import {
  createFileLocation,
  createStateId,
  createWorkspaceDescriptor
} from '../../../src/main/applicationState/identity'
import { contentSha256 } from 'common/filesystem'
import { applicationState, dirtyRecord, windowSnapshot } from '../fixtures/startupState'
import type {
  DocumentSnapshot,
  WindowCheckpointRequest
} from '../../../src/shared/types/applicationState'

const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})
const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const setup = async(recoveryHooks: StorageHooks = {}, metadataHooks: StorageHooks = {}) => {
  const directory = await mkdtemp(join(tmpdir(), 'marktext-checkpoint-'))
  directories.push(directory)
  const window = windowSnapshot()
  const document: DocumentSnapshot = {
    ...dirtyRecord(window.id).document,
    content: { kind: 'empty' }
  }
  window.documents = [document]
  window.activeDocumentId = document.id
  let failure: 'body' | 'metadata' | null = null
  const writes: string[] = []
  const metadata = new ApplicationStateStore(directory, {
    beforeReplace: async(pathname, value) => {
      writes.push('metadata')
      if (failure === 'metadata') throw new Error('metadata unavailable')
      if (metadataHooks.beforeReplace) await metadataHooks.beforeReplace(pathname, value)
    }
  })
  const recovery = new RecoveryStore(directory, {
    beforeReplace: async(pathname, value) => {
      writes.push('body')
      if (failure === 'body') throw new Error('body unavailable')
      if (recoveryHooks.beforeReplace) await recoveryHooks.beforeReplace(pathname, value)
    }
  })
  const state = applicationState([window])
  await metadata.write(state)
  writes.length = 0
  const service = new CheckpointService(state, metadata, recovery, () => 20)
  const context = await service.attachWindow(window, [{ documentId: document.id, markdown: '' }])
  const request = (
    sequence: number,
    markdown = 'Draft',
    revision = sequence
  ): WindowCheckpointRequest => ({
    contextToken: context.contextToken,
    sequence,
    closeTransactionId: null,
    layout: window.layout,
    projectView: window.projectView,
    documents: [
      {
        id: document.id,
        content: { kind: 'recovery', contentRevision: revision },
        readOnly: false,
        saveFormat: document.saveFormat,
        view: null
      }
    ],
    activeDocumentId: document.id,
    dirtyContents: [{ documentId: document.id, contentRevision: revision, markdown }]
  })
  return {
    directory,
    service,
    metadata,
    recovery,
    window,
    document,
    context,
    request,
    writes,
    fail: (value: typeof failure) => {
      failure = value
    }
  }
}

describe('durable document checkpoints', () => {
  it('persists self-contained contents before referencing metadata and does not leak bodies into metadata', async() => {
    const f = await setup()
    expect(await f.service.checkpoint(f.window.id, f.request(1))).toMatchObject({
      status: 'persisted',
      receipt: { metadataRevision: 1 }
    })
    expect(f.writes).toEqual(['body', 'metadata'])
    expect(await new RecoveryStore(f.directory).readWindow(f.window.id)).toMatchObject([
      { status: 'dirty', markdown: 'Draft' }
    ])
    expect(
      await readFile(join(f.directory, 'state', 'application-state.json'), 'utf8')
    ).not.toContain('Draft')
  })

  it.each(['body', 'metadata'] as const)(
    'retains live text and retries the same request after %s failure',
    async(stage) => {
      const f = await setup()
      f.fail(stage)
      expect(await f.service.checkpoint(f.window.id, f.request(1))).toEqual({
        status: 'failed',
        reason: 'storage-unavailable'
      })
      expect(f.service.getWindow(f.window.id)?.documents[0]?.content).toEqual({
        kind: 'recovery',
        contentRevision: 1
      })
      expect((await f.service.initializeRenderer(f.window.id)).documentContents).toEqual([
        { documentId: f.document.id, contentRevision: 1, markdown: 'Draft' }
      ])
      expect((await f.metadata.load()).value.revision).toBe(0)
      f.fail(null)
      const context = (await f.service.initializeRenderer(f.window.id)).context
      const retry = { ...f.request(1), contextToken: context.contextToken }
      expect(await f.service.checkpoint(f.window.id, retry)).toMatchObject({ status: 'persisted' })
    }
  )

  it('rejects old renderer contexts, stale sequences and a different payload at the same sequence', async() => {
    const f = await setup()
    const request = f.request(2)
    const result = await f.service.checkpoint(f.window.id, request)
    expect(await f.service.checkpoint(f.window.id, request)).toEqual(result)
    expect(await f.service.checkpoint(f.window.id, f.request(1))).toEqual({
      status: 'failed',
      reason: 'stale-sequence'
    })
    expect(await f.service.checkpoint(f.window.id, f.request(2, 'Forged'))).toEqual({
      status: 'failed',
      reason: 'stale-sequence'
    })
    await f.service.initializeRenderer(f.window.id)
    expect(await f.service.checkpoint(f.window.id, f.request(3))).toEqual({
      status: 'failed',
      reason: 'stale-context'
    })
  })

  it('does not infer a discard from an omitted tab or partially apply an invalid batch', async() => {
    const f = await setup()
    const omitted = { ...f.request(1), documents: [], dirtyContents: [], activeDocumentId: null }
    expect(await f.service.checkpoint(f.window.id, omitted)).toEqual({
      status: 'failed',
      reason: 'invalid-data'
    })
    const invalid = f.request(1)
    const firstDocument = invalid.documents[0]
    if (!firstDocument) throw new Error('Missing fixture document')
    invalid.documents.push({ ...firstDocument, id: createStateId() })
    expect(await f.service.checkpoint(f.window.id, invalid)).toEqual({
      status: 'failed',
      reason: 'invalid-data'
    })
    expect(f.service.getDocument(f.document.id).content.kind).toBe('empty')
    expect(await f.service.checkpoint(f.window.id, f.request(1))).toMatchObject({
      status: 'persisted'
    })
  })

  it('retries all pending windows before advancing global metadata', async() => {
    const f = await setup()
    f.fail('body')
    await f.service.checkpoint(f.window.id, f.request(1))
    const second = windowSnapshot()
    await f.service.attachWindow(second, [])
    f.fail(null)
    expect(
      await f.service.flush(
        second.id,
        (await f.service.initializeRenderer(second.id)).context.contextToken
      )
    ).toMatchObject({ status: 'persisted' })
    expect((await f.recovery.readWindow(f.window.id))[0]).toMatchObject({ markdown: 'Draft' })
    expect((await f.metadata.load()).value.session.windows).toHaveLength(2)
  })

  it('keeps a discarded marker if metadata fails and cleans it only after a successful commit', async() => {
    const f = await setup()
    await f.service.checkpoint(f.window.id, f.request(1))
    f.fail('metadata')
    expect(
      await f.service.endDocuments(f.window.id, [f.service.getDocument(f.document.id)], true)
    ).toMatchObject({
      status: 'failed'
    })
    expect(await new RecoveryStore(f.directory).readWindow(f.window.id)).toMatchObject([
      { status: 'discarded' }
    ])
    expect(f.service.getWindow(f.window.id)?.documents).toHaveLength(1)
    expect(f.service.getDocument(f.document.id).content.kind).toBe('recovery')
    f.fail(null)
    await f.service.endDocuments(f.window.id, [f.service.getDocument(f.document.id)], true)
    expect((await f.metadata.load()).value.session.windows[0]?.documents).toEqual([])
    expect(await f.recovery.readWindow(f.window.id)).toEqual([])
    expect(await f.service.checkpoint(f.window.id, f.request(2))).toMatchObject({
      status: 'failed'
    })
  })

  it('keeps newer typing while a real disk save is pending', async() => {
    const f = await setup()
    await f.service.checkpoint(f.window.id, f.request(1, 'Saved version'))
    const entered = deferred()
    const release = deferred()
    const save = f.service.saveDocument(f.window.id, f.document.id, async(capture) => {
      entered.resolve()
      await release.promise
      await writeFile(join(f.directory, 'saved.md'), capture.markdown)
      return {
        markdown: capture.markdown,
        snapshot: {
          ...capture.snapshot,
          resource: {
            kind: 'file',
            location: createFileLocation(join(f.directory, 'saved.md')),
            pendingCreation: false
          },
          content: {
            kind: 'disk',
            baseline: {
              exists: true,
              sizeBytes: 13,
              mtimeMs: 20,
              rawSha256: contentSha256(capture.markdown)
            }
          }
        }
      }
    })
    await entered.promise
    await f.service.checkpoint(f.window.id, f.request(2, 'Newer typing'))
    release.resolve()
    expect(await save).toMatchObject({ status: 'persisted' })
    expect(f.service.getDocument(f.document.id).content).toEqual({
      kind: 'recovery',
      contentRevision: 2
    })
    expect(await f.recovery.readWindow(f.window.id)).toMatchObject([
      { status: 'dirty', markdown: 'Newer typing' }
    ])
    expect(await readFile(join(f.directory, 'saved.md'), 'utf8')).toBe('Saved version')
  })

  it('does not publish a window removal when its critical metadata commit fails', async() => {
    const f = await setup()
    f.fail('metadata')
    await expect(
      f.service.commitState((state) => ({
        ...state,
        session: { ...state.session, windows: [], activeWindowId: null }
      }))
    ).rejects.toThrow('metadata')
    expect(f.service.getWindow(f.window.id)).not.toBeNull()
    f.fail(null)
    await f.service.commitState((state) => ({
      ...state,
      session: { ...state.session, windows: [], activeWindowId: null }
    }))
    expect(f.service.getWindow(f.window.id)).toBeNull()
    expect(() => f.service.getDocument(f.document.id)).toThrow(/unknown|closed/i)
  })

  it('does not rewrite recovery bodies for a layout-only checkpoint', async() => {
    const f = await setup()
    await f.service.checkpoint(f.window.id, f.request(1))
    f.writes.length = 0
    const next = f.request(2, 'Draft', 1)
    next.dirtyContents = []
    next.layout = { ...next.layout, tabBar: { visible: false } }
    await f.service.checkpoint(f.window.id, next)
    expect(f.writes).toEqual(['metadata'])
  })

  it('retries a failed sequence unchanged and rejects its older predecessor', async() => {
    const f = await setup()
    f.fail('metadata')
    expect(await f.service.checkpoint(f.window.id, f.request(2))).toMatchObject({
      status: 'failed'
    })
    expect(await f.service.checkpoint(f.window.id, f.request(1))).toEqual({
      status: 'failed',
      reason: 'stale-sequence'
    })
    f.fail(null)
    expect(await f.service.checkpoint(f.window.id, f.request(2))).toMatchObject({
      status: 'persisted'
    })
  })

  it('keeps successful Save As results recoverable across a metadata interruption', async() => {
    const f = await setup()
    await f.service.checkpoint(f.window.id, f.request(1))
    f.fail('metadata')
    const result = await f.service.saveDocument(f.window.id, f.document.id, async(capture) => {
      await writeFile(join(f.directory, 'actual.md'), capture.markdown)
      return {
        markdown: capture.markdown,
        snapshot: {
          ...capture.snapshot,
          resource: {
            kind: 'file',
            location: createFileLocation(join(f.directory, 'actual.md')),
            pendingCreation: false
          },
          content: {
            kind: 'disk',
            baseline: {
              exists: true,
              rawSha256: contentSha256(capture.markdown),
              sizeBytes: 5,
              mtimeMs: 20
            }
          }
        }
      }
    })
    expect(result).toMatchObject({ status: 'failed' })
    expect(await new RecoveryStore(f.directory).readWindow(f.window.id)).toMatchObject([
      {
        status: 'saved',
        document: { resource: { location: { path: join(f.directory, 'actual.md') } } }
      }
    ])
    f.fail(null)
    await f.service.flush(f.window.id, f.context.contextToken)
    expect(await f.recovery.readWindow(f.window.id)).toEqual([])
    expect((await f.metadata.load()).value.session.windows[0]?.documents[0]?.content.kind).toBe(
      'disk'
    )
  })

  it('does not change a document after cancelled or failed IO', async() => {
    const f = await setup()
    await f.service.checkpoint(f.window.id, f.request(1))
    expect(await f.service.saveDocument(f.window.id, f.document.id, async() => null)).toEqual({
      status: 'cancelled'
    })
    await expect(
      f.service.saveDocument(f.window.id, f.document.id, async() => {
        throw new Error('disk full')
      })
    ).rejects.toThrow('disk full')
    expect(f.service.getDocument(f.document.id).content.kind).toBe('recovery')
    expect(await f.recovery.readWindow(f.window.id)).toMatchObject([
      { markdown: 'Draft', status: 'dirty' }
    ])
  })

  it('does not mistake a committed metadata file for failure if only end-marker cleanup fails', async() => {
    const f = await setup()
    await f.service.checkpoint(f.window.id, f.request(1))
    let blockCleanup = true
    const cleanupErrors: unknown[] = []
    const service = new CheckpointService(
      f.service.getState(),
      f.metadata,
      {
        readWindow: (id) => f.recovery.readWindow(id),
        write: (record) => f.recovery.write(record),
        remove: async(windowId, documentId) => {
          if (blockCleanup) throw new Error('unlink unavailable')
          await f.recovery.remove(windowId, documentId)
        }
      },
      () => 30,
      (error) => cleanupErrors.push(error)
    )
    const dirty = f.service.getWindow(f.window.id)
    if (!dirty) throw new Error('Missing fixture window')
    const context = await service.attachWindow(dirty, [
      { documentId: f.document.id, markdown: 'Draft' }
    ])
    expect(
      await service.endDocuments(f.window.id, [service.getDocument(f.document.id)], true)
    ).toMatchObject({
      status: 'persisted'
    })
    expect(cleanupErrors).toHaveLength(1)
    expect((await f.metadata.load()).value.session.windows[0]?.documents).toEqual([])
    expect(await f.recovery.readWindow(f.window.id)).toMatchObject([{ status: 'discarded' }])
    blockCleanup = false
    await service.flush(f.window.id, context.contextToken)
    expect(await f.recovery.readWindow(f.window.id)).toEqual([])
  })

  it('can continue editing after a discard metadata failure without leaving a discarded marker', async() => {
    const f = await setup()
    await f.service.checkpoint(f.window.id, f.request(1))
    f.fail('metadata')
    await f.service.endDocuments(f.window.id, [f.service.getDocument(f.document.id)], true)
    f.fail(null)
    expect(await f.service.checkpoint(f.window.id, f.request(2, 'Still editing'))).toMatchObject({
      status: 'persisted'
    })
    expect(await f.recovery.readWindow(f.window.id)).toMatchObject([
      { status: 'dirty', markdown: 'Still editing' }
    ])
  })

  it('keeps two editing instances at the same path independent', async() => {
    const f = await setup()
    const second = windowSnapshot()
    await f.service.attachWindow(second, [])
    const first = {
      ...f.document,
      id: createStateId(),
      resource: {
        kind: 'file' as const,
        location: createFileLocation(join(f.directory, 'shared.md')),
        pendingCreation: true
      }
    }
    const other = { ...first, id: createStateId() }
    await f.service.addDocument(f.window.id, first, '')
    await f.service.addDocument(second.id, other, '')
    await f.service.endDocuments(f.window.id, [f.service.getDocument(first.id)], false)
    expect(f.service.getWindow(second.id)?.documents.map((document) => document.id)).toEqual([
      other.id
    ])
    expect(f.service.getDocument(other.id).resource).toEqual(first.resource)
  })

  it('preserves a newly registered draft in memory when metadata cannot be written', async() => {
    const f = await setup()
    const draft = { ...f.document, id: createStateId() }
    f.fail('metadata')
    expect(await f.service.addDocument(f.window.id, draft, '')).toMatchObject({ status: 'failed' })
    expect(f.service.getWindow(f.window.id)?.documents.map((document) => document.id)).toContain(
      draft.id
    )
    f.fail(null)
    await f.service.flush(f.window.id, f.context.contextToken)
    expect(
      (await f.metadata.load()).value.session.windows[0]?.documents.map((document) => document.id)
    ).toContain(draft.id)
  })

  it('rejects stale close confirmations even when they repeat a previously accepted sequence', async() => {
    const f = await setup()
    const transaction = createStateId()
    const request = { ...f.request(1), closeTransactionId: transaction }
    expect(await f.service.checkpoint(f.window.id, request)).toEqual({
      status: 'failed',
      reason: 'invalid-data'
    })
    await f.service.beginCloseCheckpoint(f.window.id, transaction)
    expect(await f.service.checkpoint(f.window.id, request)).toMatchObject({ status: 'persisted' })
    await f.service.cancelCloseCheckpoint(f.window.id, transaction)
    expect(await f.service.checkpoint(f.window.id, request)).toEqual({
      status: 'failed',
      reason: 'invalid-data'
    })
  })

  it('invalidates the previous root context after a workspace replacement', async() => {
    const f = await setup()
    const workspace = createWorkspaceDescriptor([f.directory])
    await f.service.commitState((state) => ({
      ...state,
      session: {
        ...state.session,
        windows: state.session.windows.map((window) => ({ ...window, workspace }))
      }
    }))
    expect(await f.service.checkpoint(f.window.id, f.request(1))).toEqual({
      status: 'failed',
      reason: 'stale-context'
    })
  })

  it('serializes saves for one document while checkpoints stay responsive', async() => {
    const f = await setup()
    await f.service.checkpoint(f.window.id, f.request(1, 'One'))
    const entered = deferred()
    const release = deferred()
    const captures: string[] = []
    const first = f.service.saveDocument(f.window.id, f.document.id, async(capture) => {
      captures.push(capture.markdown)
      entered.resolve()
      await release.promise
      return null
    })
    await entered.promise
    const second = f.service.saveDocument(f.window.id, f.document.id, async(capture) => {
      captures.push(capture.markdown)
      return null
    })
    await f.service.checkpoint(f.window.id, f.request(2, 'Two'))
    expect(captures).toEqual(['One'])
    await expect(
      f.service.commitState((state) => ({
        ...state,
        session: { ...state.session, lifecycle: 'closed' }
      }))
    ).rejects.toThrow(/pending saves/i)
    release.resolve()
    await Promise.all([first, second])
    expect(captures).toEqual(['One', 'Two'])
  })

  it('rejects malformed runtime messages without throwing or poisoning the next checkpoint', async() => {
    const f = await setup()
    const cyclic = structuredClone(f.request(1))
    Object.assign(cyclic.layout, { self: cyclic.layout })
    expect(
      await f.service.checkpoint(f.window.id, null as unknown as WindowCheckpointRequest)
    ).toEqual({ status: 'failed', reason: 'invalid-data' })
    expect(await f.service.checkpoint(f.window.id, cyclic)).toEqual({
      status: 'failed',
      reason: 'invalid-data'
    })
    expect(await f.service.checkpoint(f.window.id, f.request(1))).toMatchObject({
      status: 'persisted'
    })
  })
})

describe('atomic close validation', () => {
  it('validates current documents inside the checkpoint queue instead of committing a stale final snapshot', async() => {
    const f = await setup()
    const prepared = f.service.getState().session.windows
    const editing = f.service.checkpoint(f.window.id, f.request(1))
    const closing = f.service.closeWindows(prepared)
    expect(await editing).toMatchObject({ status: 'persisted' })
    expect(await closing).toBe(false)
    expect(f.service.getState().session.lifecycle).toBe('running')
    expect((await f.metadata.load()).value.session.windows[0].documents[0].content.kind).toBe(
      'recovery'
    )
    expect(await f.recovery.readWindow(f.window.id)).toMatchObject([
      { status: 'dirty', markdown: 'Draft' }
    ])
  })

  it('commits approved discards with the final session and rejects checkpoints after quit is committed', async() => {
    const f = await setup()
    await f.service.checkpoint(f.window.id, f.request(1))
    expect(await f.service.closeWindows(f.service.getState().session.windows)).toBe(true)
    expect((await f.metadata.load()).value.session).toMatchObject({
      lifecycle: 'closed',
      windows: [{ documents: [] }]
    })
    expect(await f.recovery.readWindow(f.window.id)).toEqual([])
    expect(await f.service.checkpoint(f.window.id, f.request(2))).toMatchObject({
      status: 'failed',
      reason: 'stale-context'
    })
  })

  it('restores dirty recovery writes after a failed final metadata commit', async() => {
    const f = await setup()
    await f.service.checkpoint(f.window.id, f.request(1))
    f.fail('metadata')
    await expect(f.service.closeWindows(f.service.getState().session.windows)).rejects.toThrow(
      'metadata unavailable'
    )
    expect(f.service.getState().session.lifecycle).toBe('running')
    f.fail(null)
    expect(await f.service.flush(f.window.id, f.context.contextToken)).toMatchObject({
      status: 'persisted'
    })
    expect(await f.recovery.readWindow(f.window.id)).toMatchObject([
      { status: 'dirty', markdown: 'Draft' }
    ])
  })
})

describe('transactional document ends', () => {
  it('retains an already persisted newer revision instead of applying old discard consent', async() => {
    const f = await setup()
    await f.service.checkpoint(f.window.id, f.request(1, 'Approved draft'))
    const prepared = f.service.getWindow(f.window.id)?.documents ?? []
    await f.service.checkpoint(f.window.id, f.request(2, 'New persisted draft'))
    expect(await f.service.endDocuments(f.window.id, prepared, true)).toMatchObject({
      status: 'failed',
      reason: 'stale-sequence'
    })
    expect((await f.metadata.load()).value.session.windows[0].documents).toHaveLength(1)
    expect(await f.recovery.readWindow(f.window.id)).toMatchObject([
      { status: 'dirty', markdown: 'New persisted draft' }
    ])
  })

  it.each([false, true])(
    'cancels the entire batch when a checkpoint arrives during recovery IO (dirty=%s)',
    async(dirty) => {
      const entered = deferred()
      const release = deferred()
      let armed = false
      const f = await setup({
        beforeReplace: async(_pathname, value) => {
          if (armed && JSON.parse(value).status === 'discarded') {
            armed = false
            entered.resolve()
            await release.promise
          }
        }
      })
      const second = dirtyRecord(f.window.id, 'Approved draft')
      if (!dirty) second.document.content = { kind: 'empty' }
      await f.service.addDocument(f.window.id, second.document, dirty ? second.markdown : '')
      const prepared = f.service.getWindow(f.window.id)?.documents ?? []
      armed = true
      const closing = f.service.endDocuments(f.window.id, prepared, true)
      await entered.promise
      const update = f.request(1, 'New draft during close', 2)
      update.documents = [
        f.service.getDocument(f.document.id),
        {
          ...f.service.getDocument(second.documentId),
          content: { kind: 'recovery', contentRevision: 2 }
        }
      ]
      update.activeDocumentId = second.documentId
      update.dirtyContents = [
        { documentId: second.documentId, contentRevision: 2, markdown: 'New draft during close' }
      ]
      const editing = f.service.checkpoint(f.window.id, update)
      release.resolve()
      expect(await closing).toMatchObject({ status: 'failed', reason: 'stale-sequence' })
      expect(await editing).toMatchObject({ status: 'persisted' })
      expect(
        (await f.metadata.load()).value.session.windows[0].documents.map((document) => document.id)
      ).toEqual(prepared.map((document) => document.id))
      expect(await f.recovery.readWindow(f.window.id)).toMatchObject([
        { status: 'dirty', markdown: 'New draft during close' }
      ])
    }
  )

  it('does not close a batch containing a document with a pending save', async() => {
    const f = await setup()
    await f.service.checkpoint(f.window.id, f.request(1))
    const entered = deferred()
    const release = deferred()
    const save = f.service.saveDocument(f.window.id, f.document.id, async() => {
      entered.resolve()
      await release.promise
      return null
    })
    await entered.promise
    expect(
      await f.service.endDocuments(
        f.window.id,
        f.service.getState().session.windows[0].documents,
        true
      )
    ).toMatchObject({ status: 'failed', reason: 'stale-sequence' })
    release.resolve()
    expect(await save).toMatchObject({ status: 'cancelled' })
    expect(f.service.getWindow(f.window.id)?.documents).toHaveLength(1)
  })

  it('retains every member and repairs dirty records after a failed batch metadata write', async() => {
    const f = await setup()
    await f.service.checkpoint(f.window.id, f.request(1))
    const second = dirtyRecord(f.window.id, 'Second draft')
    await f.service.addDocument(f.window.id, second.document, second.markdown)
    const prepared = f.service.getWindow(f.window.id)?.documents ?? []
    f.fail('metadata')
    expect(await f.service.endDocuments(f.window.id, prepared, true)).toMatchObject({
      status: 'failed',
      reason: 'storage-unavailable'
    })
    expect(f.service.getWindow(f.window.id)?.documents).toHaveLength(2)
    f.fail(null)
    await f.service.flush(f.window.id, f.context.contextToken)
    expect((await f.metadata.load()).value.session.windows[0].documents).toHaveLength(2)
    expect((await f.recovery.readWindow(f.window.id)).map((record) => record.status)).toEqual([
      'dirty',
      'dirty'
    ])
  })

  it('restores the original dirty body before returning a canceled batch even if the arriving checkpoint is rejected', async() => {
    const entered = deferred()
    const release = deferred()
    let armed = false
    const f = await setup({
      beforeReplace: async(_pathname, value) => {
        if (armed && JSON.parse(value).status === 'discarded') {
          armed = false
          entered.resolve()
          await release.promise
        }
      }
    })
    await f.service.checkpoint(f.window.id, f.request(1, 'Original recoverable body'))
    armed = true
    const closing = f.service.endDocuments(
      f.window.id,
      f.service.getState().session.windows[0].documents,
      true
    )
    await entered.promise
    const invalid = f.service.checkpoint(f.window.id, {
      ...f.request(2),
      documents: [],
      dirtyContents: [],
      activeDocumentId: null
    })
    release.resolve()
    expect(await closing).toMatchObject({ status: 'failed', reason: 'stale-sequence' })
    expect(await invalid).toMatchObject({ status: 'failed', reason: 'invalid-data' })
    expect(await f.recovery.readWindow(f.window.id)).toMatchObject([
      { status: 'dirty', markdown: 'Original recoverable body' }
    ])
  })

  it('also cancels arrivals during the final metadata write and restores the open manifest', async() => {
    const entered = deferred()
    const release = deferred()
    let armed = false
    const f = await setup(
      {},
      {
        beforeReplace: async() => {
          if (armed) {
            armed = false
            entered.resolve()
            await release.promise
          }
        }
      }
    )
    await f.service.checkpoint(f.window.id, f.request(1, 'Approved draft'))
    armed = true
    const closing = f.service.endDocuments(
      f.window.id,
      f.service.getState().session.windows[0].documents,
      true
    )
    await entered.promise
    const editing = f.service.checkpoint(f.window.id, f.request(2, 'New draft during metadata IO'))
    release.resolve()
    expect(await closing).toMatchObject({ status: 'failed', reason: 'stale-sequence' })
    expect(await editing).toMatchObject({ status: 'persisted' })
    expect((await f.metadata.load()).value.session.windows[0].documents).toHaveLength(1)
    expect(await f.recovery.readWindow(f.window.id)).toMatchObject([
      { status: 'dirty', markdown: 'New draft during metadata IO' }
    ])
  })

  it.each(['tabs', 'windows'] as const)(
    'cancels edits received during recovery cleanup before publishing %s closes',
    async(target) => {
      const f = await setup()
      await f.service.checkpoint(f.window.id, f.request(1, 'Approved draft'))
      const entered = deferred()
      const release = deferred()
      const remove = f.recovery.remove.bind(f.recovery)
      let armed = true
      f.recovery.remove = async(windowId, documentId) => {
        if (armed) {
          armed = false
          entered.resolve()
          await release.promise
        }
        await remove(windowId, documentId)
      }
      const snapshots = f.service.getState().session.windows
      let closing:
        ReturnType<typeof f.service.endDocuments> | ReturnType<typeof f.service.closeWindows>
      if (target === 'tabs') {
        closing = f.service.endDocuments(f.window.id, snapshots[0].documents, true)
      } else {
        closing = f.service.closeWindows(snapshots)
      }
      await entered.promise
      const editing = f.service.checkpoint(f.window.id, f.request(2, 'New draft during cleanup'))
      release.resolve()
      const result = await closing
      if (target === 'tabs')
        expect(result).toMatchObject({ status: 'failed', reason: 'stale-sequence' })
      else expect(result).toBe(false)
      expect(await editing).toMatchObject({ status: 'persisted' })
      expect((await f.metadata.load()).value.session.windows[0].documents).toHaveLength(1)
      expect(await f.recovery.readWindow(f.window.id)).toMatchObject([
        { status: 'dirty', markdown: 'New draft during cleanup' }
      ])
    }
  )

  it('does not leave the close guard blocked after a rejected checkpoint completes', async() => {
    const f = await setup()
    const invalid = { ...f.request(1), documents: [], dirtyContents: [], activeDocumentId: null }
    expect(await f.service.checkpoint(f.window.id, invalid)).toMatchObject({ status: 'failed' })
    expect(
      await f.service.endDocuments(
        f.window.id,
        f.service.getState().session.windows[0].documents,
        false
      )
    ).toMatchObject({ status: 'persisted' })
  })
})
