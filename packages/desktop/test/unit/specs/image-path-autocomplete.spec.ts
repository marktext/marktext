import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

import { searchFilesAndDir, watchers } from 'main_renderer/utils/imagePathAutoComplement'

// `searchFilesAndDir` is a main-process helper backed by real Node `fs`:
// it reads a directory, keeps only sub-directories + image files, fuzzy
// filters by `key`, caches the result and starts an `fs.watch` watcher.
// Each test gets a fresh disposable temp dir so the module-level cache never
// crosses test boundaries, and every watcher is torn down afterwards.

const seedDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-img-ac-'))
  fs.writeFileSync(path.join(dir, 'a.png'), '')
  fs.writeFileSync(path.join(dir, 'b.jpg'), '')
  fs.writeFileSync(path.join(dir, 'notes.txt'), '')
  fs.mkdirSync(path.join(dir, 'images'))
  return dir
}

let tmpDirs: string[] = []

beforeEach(() => {
  tmpDirs = []
})

afterEach(() => {
  for (const [dir, watcher] of watchers) {
    watcher.close()
    watchers.delete(dir)
  }
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('searchFilesAndDir', () => {
  it('returns image files as "image", sub-directories as "directory", and excludes non-image files', async() => {
    const dir = seedDir()
    tmpDirs.push(dir)

    const result = await searchFilesAndDir(dir, '')

    expect(result).toEqual(
      expect.arrayContaining([
        { file: 'a.png', type: 'image' },
        { file: 'b.jpg', type: 'image' },
        { file: 'images', type: 'directory' }
      ])
    )
    expect(result).toHaveLength(3)
    expect(result.some((e) => e.file === 'notes.txt')).toBe(false)
    expect(result.find((e) => e.file === 'images')?.type).toBe('directory')
  })

  it('starts watching the directory it scans', async() => {
    const dir = seedDir()
    tmpDirs.push(dir)

    await searchFilesAndDir(dir, '')

    expect(watchers.has(dir)).toBe(true)
  })

  it('fuzzy-filters entries by key (every match contains the typed character)', async() => {
    const dir = seedDir()
    tmpDirs.push(dir)

    const result = await searchFilesAndDir(dir, 'a')

    // fuzzaldrin matches every candidate whose name contains the subsequence
    // 'a': both "a.png" and "images" qualify, while "b.jpg" is dropped.
    expect(result.map((e) => e.file).sort()).toEqual(['a.png', 'images'])
  })

  it('narrows to a single image when the key is specific enough', async() => {
    const dir = seedDir()
    tmpDirs.push(dir)

    const result = await searchFilesAndDir(dir, 'a.p')

    expect(result).toEqual([{ file: 'a.png', type: 'image' }])
  })

  it('serves a repeated lookup of the same directory from the cache', async() => {
    const dir = seedDir()
    tmpDirs.push(dir)

    await searchFilesAndDir(dir, '')
    // Mutate the directory on disk; the cached result must be returned as-is.
    fs.writeFileSync(path.join(dir, 'c.gif'), '')

    const cached = await searchFilesAndDir(dir, '')

    expect(cached.map((e) => e.file).sort()).toEqual(['a.png', 'b.jpg', 'images'])
    expect(cached.some((e) => e.file === 'c.gif')).toBe(false)
  })

  it('rejects when the directory cannot be read', async() => {
    const missing = path.join(os.tmpdir(), 'mt-img-ac-does-not-exist-xyz')

    await expect(searchFilesAndDir(missing, '')).rejects.toBeTruthy()
  })
})
