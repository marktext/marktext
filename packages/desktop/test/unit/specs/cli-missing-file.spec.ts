import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  loadCliMarkdownFile,
  loadMarkdownFile,
  normalizeCliMarkdownPath,
  normalizeMarkdownPath,
  writeMarkdownFile
} from 'main_renderer/filesystem/markdown'

// CI skips native builds; these cases exercise UTF-8 file IO, not encoding detection.
vi.mock('ced', () => ({ default: () => 'UTF-8' }))
vi.mock('electron-log', () => ({ default: { error: vi.fn() } }))

const directories: string[] = []
const tempDirectory = () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'marktext-2143-'))
  directories.push(directory)
  return directory
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('CLI missing file (#2143)', () => {
  it('accepts a missing markdown path only for CLI opening without creating it', () => {
    const pathname = path.join(tempDirectory(), 'new note.md')
    expect(normalizeCliMarkdownPath(pathname)).toEqual({
      path: pathname,
      isDir: false,
      allowMissing: true
    })
    expect(normalizeMarkdownPath(pathname)).toBeNull()
    expect(existsSync(pathname)).toBe(false)
    expect(normalizeCliMarkdownPath(pathname.replace('.md', '.png'))).toBeNull()
  })

  it('keeps existing files and directories on the normal opening path', () => {
    const directory = tempDirectory()
    const pathname = path.join(directory, 'note.md')
    writeFileSync(pathname, 'existing')
    expect(normalizeCliMarkdownPath(pathname)).toEqual({ path: pathname, isDir: false })
    expect(normalizeCliMarkdownPath(directory)).toEqual({ path: directory, isDir: true })
    expect(normalizeCliMarkdownPath(path.join(directory, 'missing', 'note.md'))).toBeNull()
  })

  it('opens a named empty buffer and creates it only on explicit save', async() => {
    const pathname = path.join(tempDirectory(), 'note.md')
    const document = await loadCliMarkdownFile(pathname, 'utf8', 'crlf', false, 3)
    expect(document).toMatchObject({
      pathname,
      filename: 'note.md',
      markdown: '',
      isPendingCreation: true,
      lineEnding: 'crlf',
      trimTrailingNewline: 3
    })
    expect(existsSync(pathname)).toBe(false)
    await expect(loadMarkdownFile(pathname, 'lf')).rejects.toMatchObject({ code: 'ENOENT' })
    await writeMarkdownFile(pathname, document.markdown, document)
    expect(readFileSync(pathname, 'utf8')).toBe('')
  })

  it('reads a file created between CLI parsing and loading', async() => {
    const pathname = path.join(tempDirectory(), 'note.md')
    expect(normalizeCliMarkdownPath(pathname)).toHaveProperty('allowMissing', true)
    writeFileSync(pathname, 'external content')
    const document = await loadCliMarkdownFile(pathname, 'utf8', 'lf')
    expect(document.markdown).toBe('external content')
    expect(document.isPendingCreation).toBeUndefined()
  })

  it('does not turn directories or missing parent directories into new buffers', async() => {
    const directory = tempDirectory()
    await expect(loadCliMarkdownFile(directory, 'utf8', 'lf')).rejects.toBeDefined()
    await expect(
      loadCliMarkdownFile(path.join(directory, 'missing', 'note.md'), 'utf8', 'lf')
    ).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
