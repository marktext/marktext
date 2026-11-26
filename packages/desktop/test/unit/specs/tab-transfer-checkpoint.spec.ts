// @vitest-environment node
import { afterEach, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CheckpointService } from '../../../src/main/applicationState/checkpointService'
import { ApplicationStateStore, RecoveryStore } from '../../../src/main/applicationState/storage'
import { createFileLocation } from '../../../src/main/applicationState/identity'
import { applicationState, dirtyRecord, windowSnapshot } from '../fixtures/startupState'

const directories: string[] = []
afterEach(async() => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

const setup = async(onMetadataWrite?: () => void) => {
  const directory = await mkdtemp(join(tmpdir(), 'marktext-transfer-'))
  directories.push(directory)
  const source = windowSnapshot()
  const target = windowSnapshot()
  const record = dirtyRecord(source.id)
  record.document.resourceBaseDirectory = '/origin'
  source.documents = [record.document]
  source.activeDocumentId = record.documentId
  const targetRecord = dirtyRecord(target.id, 'Other draft')
  target.documents = [targetRecord.document]
  target.activeDocumentId = targetRecord.documentId
  let failMetadata = false
  const metadata = new ApplicationStateStore(directory, {
    beforeReplace: async() => {
      if (failMetadata) throw new Error('Unavailable')
      onMetadataWrite?.()
    }
  })
  const recovery = new RecoveryStore(directory)
  const service = new CheckpointService(applicationState([source, target]), metadata, recovery)
  const sourceContext = await service.attachWindow(source, [
    { documentId: record.documentId, markdown: record.markdown }
  ])
  const targetContext = await service.attachWindow(target, [
    { documentId: targetRecord.documentId, markdown: targetRecord.markdown }
  ])
  await service.flush(source.id, sourceContext.contextToken)
  const transfer = (available = () => true) =>
    service.transferDocument(
      source.id,
      target.id,
      record.documentId,
      targetRecord.documentId,
      sourceContext.contextToken,
      targetContext.contextToken,
      available
    )
  return {
    service,
    source,
    target,
    record,
    targetRecord,
    recovery,
    metadata,
    transfer,
    sourceContext,
    fail: () => {
      failMetadata = true
    }
  }
}

it('moves a dirty draft before the requested tab and durably migrates recovery ownership', async() => {
  const f = await setup()
  const contexts = await f.transfer()
  expect(f.service.getWindow(f.source.id)?.documents).toEqual([])
  expect(f.service.getWindow(f.target.id)?.documents.map((document) => document.id)).toEqual([
    f.record.documentId,
    f.targetRecord.documentId
  ])
  expect(f.service.documentPayload(f.record.documentId).markdown).toBe(f.record.markdown)
  expect(f.service.getDocument(f.record.documentId).resourceBaseDirectory).toBe('/origin')
  expect(await f.recovery.readWindow(f.source.id)).toEqual([])
  expect(await f.recovery.readWindow(f.target.id)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ documentId: f.record.documentId, markdown: f.record.markdown })
    ])
  )
  expect(contexts.source.contextToken).not.toBe(f.sourceContext.contextToken)
  expect(
    (await f.metadata.load()).value.session.windows.find((window) => window.id === f.target.id)
      ?.documents[0].id
  ).toBe(f.record.documentId)
})

it('keeps source contents and membership if metadata replacement fails', async() => {
  const f = await setup()
  f.fail()
  await expect(f.transfer()).rejects.toThrow('Unavailable')
  expect(f.service.getWindow(f.source.id)?.documents[0].id).toBe(f.record.documentId)
  expect(f.service.getWindow(f.target.id)?.documents).toHaveLength(1)
  expect(f.service.documentPayload(f.record.documentId).markdown).toBe(f.record.markdown)
  expect(await f.recovery.readWindow(f.source.id)).toEqual([
    expect.objectContaining({ markdown: f.record.markdown })
  ])
  expect(await f.recovery.readWindow(f.target.id)).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ documentId: f.record.documentId })])
  )
})

it('rejects a transfer when either renderer has disappeared', async() => {
  const f = await setup()
  await expect(f.transfer(() => false)).rejects.toThrow('Stale')
  expect(f.service.getWindow(f.source.id)?.documents).toHaveLength(1)
})

it('keeps separate untitled documents with identical display names', async() => {
  const f = await setup()
  expect(f.record.document.title).toBe(f.targetRecord.document.title)
  await f.transfer()
  expect(f.service.getWindow(f.target.id)?.documents).toHaveLength(2)
})

it('rejects duplicate canonical file identities even when contents differ', async() => {
  const f = await setup()
  const location = createFileLocation('/tmp/shared-note.md')
  await f.service.addDocument(
    f.source.id,
    {
      ...dirtyRecord(f.source.id).document,
      resource: { kind: 'file', location, pendingCreation: true }
    },
    'source',
    { baseline: { exists: false } }
  )
  const duplicate = {
    ...dirtyRecord(f.target.id).document,
    resource: { kind: 'file' as const, location, pendingCreation: true }
  }
  await f.service.addDocument(f.target.id, duplicate, 'destination', {
    baseline: { exists: false }
  })
  const document = f.service.getWindow(f.source.id)?.documents[1]
  if (!document) throw new Error('Missing test document')
  await expect(
    f.service.transferDocument(
      f.source.id,
      f.target.id,
      document.id,
      null,
      f.sourceContext.contextToken,
      (await f.service.initializeRenderer(f.target.id)).context.contextToken,
      () => true
    )
  ).rejects.toThrow('Duplicate')
  expect(f.service.documentPayload(document.id).markdown).toBe('source')
  expect(f.service.documentPayload(duplicate.id).markdown).toBe('destination')
})

it('rejects text changed after the destination received its staged snapshot', async() => {
  const f = await setup()
  const staged = f.service.documentPayload(f.record.documentId)
  const result = await f.service.checkpoint(f.source.id, {
    contextToken: f.sourceContext.contextToken,
    sequence: 1,
    closeTransactionId: null,
    layout: f.source.layout,
    projectView: f.source.projectView,
    documents: [
      {
        id: f.record.documentId,
        content: { kind: 'recovery', contentRevision: 2 },
        readOnly: false,
        saveFormat: f.record.document.saveFormat,
        view: null
      }
    ],
    activeDocumentId: f.record.documentId,
    dirtyContents: [
      { documentId: f.record.documentId, contentRevision: 2, markdown: 'newer source text' }
    ]
  })
  expect(result.status).toBe('persisted')
  const target = await f.service.initializeRenderer(f.target.id)
  await expect(
    f.service.transferDocument(
      f.source.id,
      f.target.id,
      f.record.documentId,
      null,
      f.sourceContext.contextToken,
      target.context.contextToken,
      () => true,
      staged
    )
  ).rejects.toThrow('Stale prepared tab')
  expect(f.service.documentPayload(f.record.documentId).markdown).toBe('newer source text')
  expect(f.service.getWindow(f.source.id)?.documents).toHaveLength(1)
})

it('keeps committed destination recovery when a renderer disappears during metadata replacement', async() => {
  let transferring = false
  let available = true
  const f = await setup(() => {
    if (transferring) available = false
  })
  transferring = true
  await f.transfer(() => available)
  expect(f.service.getWindow(f.target.id)?.documents[0].id).toBe(f.record.documentId)
  expect(f.service.getWindow(f.source.id)?.documents).toEqual([])
  expect(await f.recovery.readWindow(f.target.id)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ documentId: f.record.documentId, markdown: f.record.markdown })
    ])
  )
})
