// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, writeFile, readdir, mkdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rmSync } from 'node:fs'
import { ApplicationStateStore, RecoveryStore } from '../../../src/main/applicationState/storage'
import { applicationState, dirtyRecord, windowSnapshot } from '../fixtures/startupState'
import type { RecoveryRecord } from '../../../src/shared/types/applicationState'
import { createFileLocation } from '../../../src/main/applicationState/identity'
import { contentSha256 } from 'common/filesystem'

const directories: string[] = []
const profile = async(): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'marktext-new-state-'))
  directories.push(directory)
  return directory
}
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('application metadata storage', () => {
  it('captures the requested snapshot before the caller mutates it during queued IO', async() => {
    const store = new ApplicationStateStore(await profile())
    const state = applicationState([windowSnapshot()])
    const requested = structuredClone(state)
    const written = store.write(state)
    state.session.windows = []
    state.revision = 99
    await written
    expect(await store.load()).toEqual({ status: 'loaded', value: requested })
  })

  it('protects an unreadable state path without preventing in-memory defaults', async() => {
    const directory = await profile()
    const path = join(directory, 'state', 'application-state.json')
    await mkdir(path, { recursive: true })
    const store = new ApplicationStateStore(directory)
    expect(await store.load()).toMatchObject({ status: 'read-only-defaulted', reason: 'unreadable' })
    await expect(store.write(applicationState())).rejects.toThrow(/read.only/i)
    expect((await stat(path)).isDirectory()).toBe(true)
  })

  it('loads missing state without writing, then persists typed metadata', async() => {
    const directory = await profile()
    const store = new ApplicationStateStore(directory)
    const missing = await store.load()
    expect(missing.status).toBe('defaulted')
    expect(await store.load()).toEqual(missing)
    await expect(stat(join(directory, 'state'))).rejects.toMatchObject({ code: 'ENOENT' })
    const state = applicationState([windowSnapshot()])
    state.revision = 1
    await store.write(state)
    expect(await store.load()).toEqual({ status: 'loaded', value: state })
  })

  it.each(['{broken', JSON.stringify({ schemaVersion: 999 })])(
    'protects unreadable formats across later writes: %s',
    async(input) => {
      const directory = await profile()
      await mkdir(join(directory, 'state'))
      const path = join(directory, 'state', 'application-state.json')
      await writeFile(path, input)
      const store = new ApplicationStateStore(directory)
      expect((await store.load()).status).toBe('read-only-defaulted')
      await expect(store.write(applicationState())).rejects.toThrow(/read.only/i)
      expect(await readFile(path, 'utf8')).toBe(input)
    }
  )

  it('serializes writes and retains the last valid file after a failed replacement', async() => {
    const directory = await profile()
    const order: number[] = []
    let fail = false
    const store = new ApplicationStateStore(directory, {
      beforeReplace: async(_path, value) => {
        const state = JSON.parse(value) as { revision: number }
        order.push(state.revision)
        if (fail) throw new Error('simulated replacement failure')
      }
    })
    const state = applicationState()
    await Promise.all([
      store.write({ ...state, revision: 1 }),
      store.write({ ...state, revision: 2 })
    ])
    expect(order).toEqual([1, 2])
    fail = true
    await expect(store.write({ ...state, revision: 3 })).rejects.toThrow('simulated')
    expect((await store.load()).value.revision).toBe(2)
    fail = false
    await store.write({ ...state, revision: 4 })
    expect((await store.load()).value.revision).toBe(4)
  })

  it('keeps valid windows when a different window has invalid metadata', async() => {
    const directory = await profile()
    await mkdir(join(directory, 'state'))
    const valid = windowSnapshot()
    const state = applicationState([valid])
    await writeFile(
      join(directory, 'state', 'application-state.json'),
      JSON.stringify({
        ...state,
        session: { ...state.session, windows: [valid, { id: 'invalid' }] }
      })
    )
    const result = await new ApplicationStateStore(directory).load()
    expect(result.status).toBe('loaded')
    expect(result.value.session.windows).toEqual([valid])
  })

  it('does not persist accidental editor content in metadata', async() => {
    const directory = await profile()
    const store = new ApplicationStateStore(directory)
    const editorWindow = { ...windowSnapshot(), markdown: 'accidental body' }
    const state = applicationState([editorWindow])
    await store.write(state)
    expect(await readFile(join(directory, 'state', 'application-state.json'), 'utf8')).not.toContain('accidental body')
  })
})

describe('latest document recovery storage', () => {
  it('retains saved-path results across a restart until metadata makes cleanup safe', async() => {
    const directory = await profile()
    const store = new RecoveryStore(directory)
    const record = dirtyRecord()
    await store.write(record)
    const filePath = join(directory, 'saved.md')
    await writeFile(filePath, record.markdown)
    const saved: RecoveryRecord = {
      schemaVersion: 1, status: 'saved', ownerWindowId: record.ownerWindowId,
      documentId: record.documentId, contentRevision: 1, updatedAtMs: 20,
      document: {
        ...record.document,
        resource: { kind: 'file', location: createFileLocation(filePath), pendingCreation: false },
        content: { kind: 'disk', baseline: { exists: true, sizeBytes: Buffer.byteLength(record.markdown), mtimeMs: 20, rawSha256: contentSha256(record.markdown) } }
      }
    }
    await store.write(saved)
    const restarted = new RecoveryStore(directory)
    expect(await restarted.readWindow(record.ownerWindowId)).toEqual([saved])
    await restarted.remove(record.ownerWindowId, record.documentId)
    expect(await restarted.readWindow(record.ownerWindowId)).toEqual([])
    expect(await readFile(filePath, 'utf8')).toBe(record.markdown)
  })

  it('overwrites the same document and reads only the requested window', async() => {
    const directory = await profile()
    const store = new RecoveryStore(directory)
    const first = dirtyRecord()
    const other = dirtyRecord()
    await store.write(first)
    await store.write(other)
    const newest = dirtyRecord(first.ownerWindowId, 'Newer text\n')
    newest.documentId = first.documentId
    newest.document.id = first.documentId
    newest.contentRevision = 2
    newest.document.content = { kind: 'recovery', contentRevision: 2 }
    await store.write(newest)
    expect(await readdir(join(directory, 'recovery', first.ownerWindowId))).toEqual([
      `${first.documentId}.json`
    ])
    expect(await store.readWindow(first.ownerWindowId)).toEqual([newest])
    expect(await store.readWindow(other.ownerWindowId)).toEqual([other])
  })

  it('does not delete a dirty document; deletes only a completed end marker', async() => {
    const store = new RecoveryStore(await profile())
    const record = dirtyRecord()
    await store.write(record)
    await expect(store.remove(record.ownerWindowId, record.documentId)).rejects.toThrow(/dirty/i)
    const discarded: RecoveryRecord = {
      schemaVersion: 1,
      status: 'discarded',
      ownerWindowId: record.ownerWindowId,
      documentId: record.documentId,
      contentRevision: 1,
      updatedAtMs: 20
    }
    await store.write(discarded)
    await store.remove(record.ownerWindowId, record.documentId)
    expect(await store.readWindow(record.ownerWindowId)).toEqual([])
  })

  it('preserves corrupt records while returning other valid documents', async() => {
    const directory = await profile()
    const store = new RecoveryStore(directory)
    const valid = dirtyRecord()
    const corrupt = dirtyRecord(valid.ownerWindowId)
    await store.write(valid)
    await store.write(corrupt)
    const path = join(directory, 'recovery', corrupt.ownerWindowId, `${corrupt.documentId}.json`)
    await writeFile(path, '{corrupt')
    expect(await store.readWindow(valid.ownerWindowId)).toEqual([valid])
    await expect(store.write(corrupt)).rejects.toThrow(/read.only/i)
    expect(await readFile(path, 'utf8')).toBe('{corrupt')
  })

  it('serializes end-marker deletion with subsequent edits on the same document', async() => {
    const store = new RecoveryStore(await profile())
    const record = dirtyRecord()
    await store.write({
      schemaVersion: 1,
      status: 'discarded',
      ownerWindowId: record.ownerWindowId,
      documentId: record.documentId,
      contentRevision: 0,
      updatedAtMs: 10
    })
    await Promise.all([store.remove(record.ownerWindowId, record.documentId), store.write(record)])
    expect(await store.readWindow(record.ownerWindowId)).toEqual([record])
  })

  it('rejects invalid IDs, hashes and mismatched self-contained document metadata', async() => {
    const store = new RecoveryStore(await profile())
    const record = dirtyRecord()
    await expect(store.readWindow('../outside')).rejects.toThrow(/identity/i)
    await expect(store.write({ ...record, contentSha256: '0'.repeat(64) })).rejects.toThrow(
      /invalid/i
    )
    await expect(
      store.write({ ...record, document: { ...record.document, id: dirtyRecord().documentId } })
    ).rejects.toThrow(/invalid/i)
  })

  it('reports actual write errors without leaving a valid-looking replacement', async() => {
    const directory = await profile()
    const beforeReplace = vi.fn().mockRejectedValue(new Error('disk full'))
    const store = new RecoveryStore(directory, { beforeReplace })
    const record = dirtyRecord()
    await expect(store.write(record)).rejects.toThrow('disk full')
    expect(await store.readWindow(record.ownerWindowId)).toEqual([])
  })
})
