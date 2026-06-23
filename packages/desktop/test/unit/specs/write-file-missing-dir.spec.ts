import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { writeFile } from 'main_renderer/filesystem'

// #3509: with autosave on, moving/deleting a file's folder while it is open
// makes the save target a now-missing directory. MarkText intentionally
// recreates the directory tree and writes the file (via fs-extra `outputFile`),
// matching VS Code, so an (auto)save never silently fails or loses edits. These
// tests pin that behavior.

const dirs: string[] = []
function tempDir(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'mt-3509-'))
  dirs.push(d)
  return d
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

describe('writeFile — missing parent directory (#3509)', () => {
  it('recreates a directory that no longer exists and writes the file', async() => {
    const base = tempDir()
    const missingDir = path.join(base, 'moved-away')
    const target = path.join(missingDir, 'note.md')

    await writeFile(target, 'hello', undefined)

    expect(existsSync(missingDir)).toBe(true)
    expect(readFileSync(target, 'utf-8')).toBe('hello')
  })

  it('writes normally when the parent directory exists', async() => {
    const base = tempDir()
    const target = path.join(base, 'note.md')

    await writeFile(target, 'hello', undefined)

    expect(readFileSync(target, 'utf-8')).toBe('hello')
  })
})
