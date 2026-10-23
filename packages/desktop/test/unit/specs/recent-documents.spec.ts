import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RecentDocumentsStore, isVolumeRootPath } from 'main_renderer/menu/recentDocuments'

describe('isVolumeRootPath', () => {
  it('recognizes mount roots below the standard volume containers', () => {
    expect(isVolumeRootPath('/Volumes/USB')).toBe(true)
    expect(isVolumeRootPath('/media/user/USB')).toBe(true)
    expect(isVolumeRootPath('/mnt/data')).toBe(true)
    expect(isVolumeRootPath('/run/media/user/USB')).toBe(true)
    expect(isVolumeRootPath('/home/user/notes')).toBe(false)
  })
})

describe('RecentDocumentsStore', () => {
  let tempDir: string
  let storagePath: string

  const makeFile = (name: string): string => {
    const filePath = path.join(tempDir, name)
    fs.writeFileSync(filePath, '')
    return filePath
  }

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-recents-'))
    storagePath = path.join(tempDir, 'recently-used-documents.json')
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('keeps every entry without a fixed limit', () => {
    const store = new RecentDocumentsStore(storagePath)
    const files = Array.from({ length: 20 }, (_, i) => makeFile(`file-${i}.md`))
    files.forEach((file) => store.add(file))

    expect(store.read().map((document) => document.pathname)).toEqual([...files].reverse())
  })

  it('moves an existing entry to the front instead of duplicating it', () => {
    const store = new RecentDocumentsStore(storagePath)
    const [a, b, c] = ['a.md', 'b.md', 'c.md'].map(makeFile)
    store.add(a)
    store.add(b)
    store.add(c)
    store.add(a)

    expect(store.read().map((document) => document.pathname)).toEqual([a, c, b])
  })

  it('drops entries that no longer exist and persists the cleanup', () => {
    const store = new RecentDocumentsStore(storagePath)
    const kept = makeFile('kept.md')
    const removed = makeFile('removed.md')
    store.add(kept)
    store.add(removed)
    fs.rmSync(removed)

    expect(store.read().map((document) => document.pathname)).toEqual([kept])
    expect(JSON.parse(fs.readFileSync(storagePath, 'utf-8'))).toEqual([kept])
  })

  it('keeps entries whose parent folder is unavailable', () => {
    const store = new RecentDocumentsStore(storagePath)
    const unavailable = path.join(tempDir, 'unmounted-volume', 'note.md')
    fs.writeFileSync(storagePath, JSON.stringify([unavailable]), 'utf-8')

    expect(store.read()).toEqual([])
    expect(JSON.parse(fs.readFileSync(storagePath, 'utf-8'))).toEqual([unavailable])
  })

  it('reports directories alongside files', () => {
    const store = new RecentDocumentsStore(storagePath)
    const directory = path.join(tempDir, 'notes')
    fs.mkdirSync(directory)
    const file = makeFile('todo.md')
    store.add(file)
    store.add(directory)

    expect(store.read()).toEqual([
      { pathname: directory, isDirectory: true },
      { pathname: file, isDirectory: false }
    ])
  })

  it('removes a single entry and persists the remaining order', () => {
    const store = new RecentDocumentsStore(storagePath)
    const [a, b, c] = ['a.md', 'b.md', 'c.md'].map(makeFile)
    store.add(a)
    store.add(b)
    store.add(c)

    store.remove(b)

    expect(store.read().map((document) => document.pathname)).toEqual([c, a])
    expect(JSON.parse(fs.readFileSync(storagePath, 'utf-8'))).toEqual([c, a])
  })

  it('clears the list', () => {
    const store = new RecentDocumentsStore(storagePath)
    store.add(makeFile('a.md'))

    store.clear()

    expect(store.read()).toEqual([])
    expect(JSON.parse(fs.readFileSync(storagePath, 'utf-8'))).toEqual([])
  })
})
