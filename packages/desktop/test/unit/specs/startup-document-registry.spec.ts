// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { DocumentRegistry } from '../../../src/main/applicationState/documentRegistry'
import { createFileLocation, contentSha256 } from '../../../src/main/applicationState/identity'
import { dirtyRecord } from '../fixtures/startupState'
import type {
  DocumentSnapshot,
  RendererDocumentCheckpoint
} from '../../../src/shared/types/applicationState'

const registration = (disk = false) => {
  const record = dirtyRecord()
  const snapshot: DocumentSnapshot = {
    ...record.document,
    resource: disk
      ? { kind: 'file', location: createFileLocation('existing.md'), pendingCreation: false }
      : { kind: 'untitled' },
    content: disk
      ? {
        kind: 'disk',
        baseline: { exists: true, sizeBytes: 8, mtimeMs: 1, rawSha256: contentSha256('Original') }
      }
      : { kind: 'empty' }
  }
  const registry = new DocumentRegistry()
  registry.register(record.ownerWindowId, snapshot, disk ? 'Original' : '')
  return { registry, snapshot, windowId: record.ownerWindowId }
}
const metadata = (snapshot: DocumentSnapshot): RendererDocumentCheckpoint => ({
  id: snapshot.id,
  content: snapshot.content,
  saveFormat: snapshot.saveFormat,
  readOnly: snapshot.readOnly,
  view: snapshot.view
})

describe('document identity and content lifecycle', () => {
  it('relocates dirty text without changing identity, revision or the original disk baseline', () => {
    const { registry, snapshot, windowId } = registration(true)
    const baseline = registry.baseline(snapshot.id)
    registry.apply([
      registry.prepare(
        windowId,
        { ...metadata(snapshot), content: { kind: 'recovery', contentRevision: 1 } },
        { documentId: snapshot.id, contentRevision: 1, markdown: 'Edited' }
      )
    ])
    const location = createFileLocation('renamed.md')
    registry.relocate(snapshot.id, location, 'renamed.md')
    expect(registry.get(snapshot.id)).toMatchObject({
      id: snapshot.id,
      title: 'renamed.md',
      resource: { location },
      content: { kind: 'recovery', contentRevision: 1 }
    })
    expect(registry.baseline(snapshot.id)).toEqual(baseline)
    expect(registry.pendingRecords(10)).toMatchObject([
      { status: 'dirty', markdown: 'Edited', baseline, document: { resource: { location } } }
    ])
  })
  it('accepts a verified external reload as clean without treating it as an unsaved edit', () => {
    const { registry, snapshot, windowId } = registration(true)
    const external: DocumentSnapshot = {
      ...snapshot,
      content: {
        kind: 'disk',
        baseline: { exists: true, sizeBytes: 8, mtimeMs: 30, rawSha256: contentSha256('External') }
      }
    }
    registry.observeDisk(snapshot.id, external, 'External')
    registry.apply([
      registry.prepare(
        windowId,
        { ...metadata(snapshot), content: { kind: 'recovery', contentRevision: 1 } },
        { documentId: snapshot.id, contentRevision: 1, markdown: 'External' }
      )
    ])
    expect(registry.get(snapshot.id).content).toEqual(external.content)
    expect(registry.baseline(snapshot.id)).toEqual(
      external.content.kind === 'disk' ? external.content.baseline : null
    )
  })
  it('retains the last text for a deleted disk file even without a new content revision', () => {
    const { registry, snapshot, windowId } = registration(true)
    registry.observeDisk(snapshot.id, null)
    registry.apply([
      registry.prepare(windowId, {
        ...metadata(snapshot),
        content: { kind: 'recovery', contentRevision: 0 }
      })
    ])
    expect(registry.pendingRecords(10)).toMatchObject([
      { status: 'dirty', markdown: 'Original', contentRevision: 0 }
    ])
    expect(() => registry.close(snapshot.id)).toThrow(/unsaved/i)
  })
  it('protects ownership and rejects a clean claim without matching saved text', () => {
    const { registry, snapshot, windowId } = registration(true)
    const update = registry.prepare(
      windowId,
      { ...metadata(snapshot), content: { kind: 'recovery', contentRevision: 1 } },
      { documentId: snapshot.id, contentRevision: 1, markdown: 'Edited' }
    )
    registry.apply([update])
    expect(() => registry.prepare('another-window', metadata(snapshot))).toThrow(/owner/i)
    expect(() => registry.prepare(windowId, metadata(snapshot))).toThrow(/saved|clean/i)
    expect(registry.text(snapshot.id)).toBe('Edited')
    expect(registry.get(snapshot.id).content.kind).toBe('recovery')
  })

  it('rejects changed content at an old revision without altering current data', () => {
    const { registry, snapshot, windowId } = registration()
    const dirty = {
      ...metadata(snapshot),
      content: { kind: 'recovery' as const, contentRevision: 1 }
    }
    registry.apply([
      registry.prepare(windowId, dirty, {
        documentId: snapshot.id,
        contentRevision: 1,
        markdown: 'First'
      })
    ])
    expect(() =>
      registry.prepare(windowId, dirty, {
        documentId: snapshot.id,
        contentRevision: 1,
        markdown: 'Later'
      })
    ).toThrow(/revision/i)
    expect(registry.text(snapshot.id)).toBe('First')
  })

  it('accepts a verified undo to disk content and creates a settled marker', () => {
    const { registry, snapshot, windowId } = registration(true)
    registry.apply([
      registry.prepare(
        windowId,
        { ...metadata(snapshot), content: { kind: 'recovery', contentRevision: 1 } },
        { documentId: snapshot.id, contentRevision: 1, markdown: 'Changed' }
      )
    ])
    registry.apply([
      registry.prepare(windowId, metadata(snapshot), {
        documentId: snapshot.id,
        contentRevision: 2,
        markdown: 'Original'
      })
    ])
    expect(registry.get(snapshot.id).content.kind).toBe('disk')
    expect(registry.pendingRecords(10)).toMatchObject([{ status: 'saved', contentRevision: 2 }])
  })

  it('keeps newer text dirty when an earlier save finishes and rebinds Save As to its actual path', () => {
    const { registry, snapshot, windowId } = registration(true)
    registry.apply([
      registry.prepare(
        windowId,
        { ...metadata(snapshot), content: { kind: 'recovery', contentRevision: 1 } },
        { documentId: snapshot.id, contentRevision: 1, markdown: 'Saved version' }
      )
    ])
    registry.apply([
      registry.prepare(
        windowId,
        { ...metadata(snapshot), content: { kind: 'recovery', contentRevision: 2 } },
        { documentId: snapshot.id, contentRevision: 2, markdown: 'Newer typing' }
      )
    ])
    const saved: DocumentSnapshot = {
      ...snapshot,
      resource: {
        kind: 'file',
        location: createFileLocation('saved-as.md'),
        pendingCreation: false
      },
      content: {
        kind: 'disk',
        baseline: {
          exists: true,
          sizeBytes: 13,
          mtimeMs: 2,
          rawSha256: contentSha256('Saved version')
        }
      }
    }
    registry.markSaved(snapshot.id, 1, saved, 'Saved version')
    expect(registry.text(snapshot.id)).toBe('Newer typing')
    expect(registry.get(snapshot.id)).toMatchObject({
      id: snapshot.id,
      resource: saved.resource,
      content: { kind: 'recovery', contentRevision: 2 }
    })
    expect(registry.savedDocuments().get(snapshot.id)?.resource).toEqual(saved.resource)
    expect(registry.pendingRecords(10)).toMatchObject([
      {
        status: 'dirty',
        markdown: 'Newer typing',
        baseline: saved.content.kind === 'disk' ? saved.content.baseline : null
      }
    ])
  })

  it('does not treat an unsaved encoding change as a clean document', () => {
    const { registry, snapshot, windowId } = registration(true)
    const format = structuredClone(snapshot.saveFormat)
    format.encoding.encoding = 'ascii'
    const changed = {
      ...metadata(snapshot),
      saveFormat: format,
      content: { kind: 'recovery' as const, contentRevision: 1 }
    }
    registry.apply([
      registry.prepare(windowId, changed, {
        documentId: snapshot.id,
        contentRevision: 1,
        markdown: 'Original'
      })
    ])
    expect(() => registry.prepare(windowId, { ...changed, content: snapshot.content })).toThrow(
      /saved|clean/i
    )
    expect(registry.savedDocuments().get(snapshot.id)?.saveFormat.encoding.encoding).toBe('utf8')
  })

  it('requires explicit discard for dirty contents and rejects later revival', () => {
    const { registry, snapshot, windowId } = registration()
    registry.apply([
      registry.prepare(
        windowId,
        { ...metadata(snapshot), content: { kind: 'recovery', contentRevision: 1 } },
        { documentId: snapshot.id, contentRevision: 1, markdown: 'Draft' }
      )
    ])
    expect(() => registry.close(snapshot.id)).toThrow(/unsaved/i)
    registry.discard(snapshot.id)
    expect(registry.pendingRecords(10)).toMatchObject([
      { status: 'discarded', documentId: snapshot.id }
    ])
    expect(() => registry.prepare(windowId, metadata(snapshot))).toThrow(/closed/i)
  })

  it('does not rewrite a committed body when only the view changes', () => {
    const { registry, snapshot, windowId } = registration()
    const dirty = {
      ...metadata(snapshot),
      content: { kind: 'recovery' as const, contentRevision: 1 }
    }
    registry.apply([
      registry.prepare(windowId, dirty, {
        documentId: snapshot.id,
        contentRevision: 1,
        markdown: 'Draft'
      })
    ])
    const record = registry.pendingRecords(10)[0]
    if (!record) throw new Error('Missing fixture recovery record')
    registry.settle(record)
    registry.apply([
      registry.prepare(windowId, {
        ...dirty,
        view: {
          contentSha256: contentSha256('Draft'),
          sourceSelection: null,
          muyaSelection: null,
          sourceScrollTopPx: 100,
          renderedScrollTopPx: 0,
          collapsedOutlineKeys: []
        }
      })
    ])
    expect(registry.pendingRecords(20)).toEqual([])
  })

  it('rejects a batch prepared before a save changed its baseline', () => {
    const { registry, snapshot, windowId } = registration(true)
    const prepared = registry.prepare(windowId, metadata(snapshot))
    registry.markSaved(snapshot.id, 0, snapshot, 'Original')
    expect(() => registry.apply([prepared])).toThrow(/stale/i)
  })

  it('keeps a restored dirty file original baseline even when disk has changed externally', () => {
    const { snapshot, windowId } = registration(true)
    const baseline = snapshot.content.kind === 'disk' ? snapshot.content.baseline : null
    const registry = new DocumentRegistry()
    const dirty: DocumentSnapshot = {
      ...snapshot,
      content: { kind: 'recovery', contentRevision: 5 }
    }
    const external: DocumentSnapshot = {
      ...snapshot,
      content: {
        kind: 'disk',
        baseline: {
          exists: true,
          rawSha256: contentSha256('External change'),
          sizeBytes: 15,
          mtimeMs: 30
        }
      }
    }
    registry.register(windowId, dirty, 'Our edits', {
      baseline,
      saved: { snapshot: external, markdown: 'External change' }
    })
    expect(registry.pendingRecords(40)).toMatchObject([{ baseline, markdown: 'Our edits' }])
  })

  it('records a missing baseline for a named file that has never been created', () => {
    const { snapshot, windowId } = registration()
    const registry = new DocumentRegistry()
    snapshot.resource = {
      kind: 'file',
      location: createFileLocation('not-created.md'),
      pendingCreation: true
    }
    registry.register(windowId, snapshot, '')
    registry.apply([
      registry.prepare(
        windowId,
        { ...metadata(snapshot), content: { kind: 'recovery', contentRevision: 1 } },
        { documentId: snapshot.id, contentRevision: 1, markdown: 'Named draft' }
      )
    ])
    expect(registry.pendingRecords(10)).toMatchObject([{ baseline: { exists: false } }])
  })

  it('keeps deleting all text from a disk file dirty', () => {
    const { registry, snapshot, windowId } = registration(true)
    registry.apply([
      registry.prepare(
        windowId,
        { ...metadata(snapshot), content: { kind: 'recovery', contentRevision: 1 } },
        { documentId: snapshot.id, contentRevision: 1, markdown: '' }
      )
    ])
    expect(registry.pendingRecords(10)).toMatchObject([{ status: 'dirty', markdown: '' }])
    expect(() => registry.close(snapshot.id)).toThrow(/unsaved/i)
  })
})

it('keeps the accepted external baseline when reload and undo happen before the next checkpoint', () => {
  const { registry, snapshot, windowId } = registration(true)
  const baseline = {
    exists: true as const,
    rawSha256: contentSha256('External'),
    sizeBytes: 8,
    mtimeMs: 20
  }
  registry.observeDisk(
    snapshot.id,
    { ...snapshot, content: { kind: 'disk', baseline } },
    'External'
  )
  registry.apply([
    registry.prepare(windowId, {
      ...metadata(snapshot),
      content: { kind: 'recovery', contentRevision: 0 },
      acceptedDiskSha256: baseline.rawSha256
    })
  ])
  expect(registry.get(snapshot.id).content.kind).toBe('recovery')
  expect(registry.baseline(snapshot.id)).toEqual(baseline)
  expect(registry.pendingRecords(30)).toMatchObject([
    { status: 'dirty', markdown: 'Original', baseline }
  ])
  const record = registry.pendingRecords(30)[0]
  registry.settle(record)
  registry.apply([
    registry.prepare(windowId, {
      ...metadata(snapshot),
      content: { kind: 'recovery', contentRevision: 0 },
      acceptedDiskSha256: baseline.rawSha256
    })
  ])
  expect(registry.pendingRecords(40)).toEqual([])
})
