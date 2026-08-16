import { mkdtempSync, readdirSync, utimesSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

// The store registers ipcMain handlers in its constructor; stub electron so the
// module imports without a real main process, then build instances off the
// prototype so no handler registration happens.
vi.mock('electron', () => ({}))

const { default: EditorBufferStore } = await import('main_renderer/editorBufferStore')

const dirs: string[] = []
function tempDir(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'mt-buf-restore-'))
  dirs.push(d)
  return d
}

function makeStore(dir: string): InstanceType<typeof EditorBufferStore> {
  const store = Object.create(EditorBufferStore.prototype) as InstanceType<typeof EditorBufferStore>
  store.editorBufferStorePath = dir
  store.bufferStores = null
  return store
}

/** Write a buffer store whose mtime encodes recency: higher `age` is newer. */
function writeStore(dir: string, id: string, pathnames: Array<string | null>, age: number): void {
  const file = path.join(dir, `${id}_editor_buffer_store.json`)
  writeFileSync(
    file,
    JSON.stringify({
      tabs: pathnames.map((pathname, i) => ({ id: `mt-${i}`, pathname, isSaved: false }))
    })
  )
  const t = new Date(2020, 0, 1 + age)
  utimesSync(file, t, t)
}

function idsIn(dir: string): string[] {
  return readdirSync(dir)
    .map((name) => name.replace('_editor_buffer_store.json', ''))
    .sort()
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

describe('EditorBufferStore.getRestorableBufferStores', () => {
  it('collapses repeated snapshots of the same document to the newest one', () => {
    const dir = tempDir()
    writeStore(dir, 'old', ['/docs/a.md'], 1)
    writeStore(dir, 'newest', ['/docs/a.md'], 3)
    writeStore(dir, 'middle', ['/docs/a.md'], 2)

    const restorable = makeStore(dir).getRestorableBufferStores()

    expect(restorable.map((e) => e.id)).toEqual(['newest'])
    // Superseded snapshots are removed so the directory cannot grow unbounded.
    expect(idsIn(dir)).toEqual(['newest'])
  })

  it('keeps one window per distinct document', () => {
    const dir = tempDir()
    writeStore(dir, 'a', ['/docs/a.md'], 1)
    writeStore(dir, 'b', ['/docs/b.md'], 1)

    const restorable = makeStore(dir).getRestorableBufferStores()

    expect(restorable.map((e) => e.id).sort()).toEqual(['a', 'b'])
    expect(idsIn(dir)).toEqual(['a', 'b'])
  })

  it('treats tab sets as the restore identity regardless of tab order', () => {
    const dir = tempDir()
    writeStore(dir, 'first', ['/docs/a.md', '/docs/b.md'], 1)
    writeStore(dir, 'reordered', ['/docs/b.md', '/docs/a.md'], 2)

    const restorable = makeStore(dir).getRestorableBufferStores()

    expect(restorable.map((e) => e.id)).toEqual(['reordered'])
  })

  it('never collapses untitled drafts, whose content exists nowhere else', () => {
    const dir = tempDir()
    writeStore(dir, 'draft1', [null], 1)
    writeStore(dir, 'draft2', [null], 2)
    writeStore(dir, 'mixed', ['/docs/a.md', null], 3)

    const restorable = makeStore(dir).getRestorableBufferStores()

    expect(restorable.map((e) => e.id).sort()).toEqual(['draft1', 'draft2', 'mixed'])
    expect(idsIn(dir)).toEqual(['draft1', 'draft2', 'mixed'])
  })

  it('skips unreadable stores instead of aborting the restore', () => {
    const dir = tempDir()
    writeStore(dir, 'good', ['/docs/a.md'], 1)
    writeFileSync(path.join(dir, 'broken_editor_buffer_store.json'), 'not json')

    const restorable = makeStore(dir).getRestorableBufferStores()

    expect(restorable.map((e) => e.id)).toEqual(['good'])
    // A store we could not parse is left alone rather than deleted.
    expect(idsIn(dir)).toEqual(['broken', 'good'])
  })
})
