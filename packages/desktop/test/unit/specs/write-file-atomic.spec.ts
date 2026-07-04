import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as fsExtra from 'fs-extra'
import { writeFile } from 'main_renderer/filesystem'

// #3786 / #3828: saves used a plain (truncate-then-write) `outputFile`, so a
// crash/power-loss mid-write left the user's document truncated to 0 bytes.
// writeFile now writes to a temp file in the same directory and renames it over
// the target, so an interrupted write can only ever corrupt the throwaway temp
// file — never the existing document. These tests pin that guarantee.

vi.mock('fs-extra', async(importOriginal) => {
  const actual = await importOriginal<typeof fsExtra>()
  return { ...actual, rename: vi.fn(actual.rename) }
})

const dirs: string[] = []
function tempDir(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'mt-atomic-'))
  dirs.push(d)
  return d
}

afterEach(() => {
  vi.mocked(fsExtra.rename).mockClear()
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

describe('writeFile — atomic save (#3786, #3828)', () => {
  it('leaves the existing file intact when the write fails partway', async() => {
    const dir = tempDir()
    const target = path.join(dir, 'note.md')
    writeFileSync(target, 'ORIGINAL CONTENT')

    // Fail the rename step (the moment a non-atomic write would already have
    // clobbered the original with a partial/empty file).
    vi.mocked(fsExtra.rename).mockRejectedValueOnce(new Error('simulated crash'))

    await expect(writeFile(target, 'NEW CONTENT', undefined)).rejects.toThrow()

    // The original document must survive untouched.
    expect(readFileSync(target, 'utf-8')).toBe('ORIGINAL CONTENT')
    // No temp turds left behind.
    expect(readdirSync(dir)).toEqual(['note.md'])
  })

  it('writes the new content and overwrites an existing file on success', async() => {
    const dir = tempDir()
    const target = path.join(dir, 'note.md')
    writeFileSync(target, 'OLD')

    await writeFile(target, 'NEW', undefined)

    expect(readFileSync(target, 'utf-8')).toBe('NEW')
    // Only the final file remains — no leftover temp file.
    expect(readdirSync(dir)).toEqual(['note.md'])
  })

  it('still recreates a missing parent directory (#3509)', async() => {
    const base = tempDir()
    const target = path.join(base, 'moved-away', 'note.md')

    await writeFile(target, 'hello', undefined)

    expect(existsSync(path.dirname(target))).toBe(true)
    expect(readFileSync(target, 'utf-8')).toBe('hello')
  })
})
