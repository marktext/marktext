import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

// The store registers ipcMain handlers in its constructor; stub electron so the
// module imports without a real main process. writeBufferStoreFile no longer
// touches `this`, so we exercise it via the prototype without booting the store.
vi.mock('electron', () => ({}))

const { default: EditorBufferStore } = await import('main_renderer/editorBufferStore')

// #4852 follow-up: the crash-recovery buffer holds unsaved tab content but used
// a temp+rename with no fsync — the same power-loss zero-fill gap the document
// save path had. writeBufferStoreFile now writes durably via write-file-atomic.
const writeBufferStoreFile = EditorBufferStore.prototype.writeBufferStoreFile

const dirs: string[] = []
function tempDir(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'mt-buf-'))
  dirs.push(d)
  return d
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

describe('EditorBufferStore.writeBufferStoreFile — durable atomic write (#4852 follow-up)', () => {
  it('writes the state as JSON and leaves no temp file behind', () => {
    const dir = tempDir()
    const target = path.join(dir, 'buffer.json')
    const state = { tabs: [{ id: '1', markdown: 'hello' }] }

    writeBufferStoreFile(target, state)

    expect(JSON.parse(readFileSync(target, 'utf8'))).toEqual(state)
    // The temp file was renamed over the target — nothing left in the dir.
    expect(readdirSync(dir)).toEqual(['buffer.json'])
  })

  it('overwrites an existing buffer file', () => {
    const dir = tempDir()
    const target = path.join(dir, 'buffer.json')

    writeBufferStoreFile(target, { tabs: ['old'] })
    writeBufferStoreFile(target, { tabs: ['new'] })

    expect(JSON.parse(readFileSync(target, 'utf8'))).toEqual({ tabs: ['new'] })
    expect(readdirSync(dir)).toEqual(['buffer.json'])
  })
})
