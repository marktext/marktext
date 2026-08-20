import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { writeFile } from 'main_renderer/filesystem'

// #3786 / #3828: saves must survive an application crash AND a power loss.
// writeFile writes to a temp file, fsyncs it, then renames it over the target
// (via write-file-atomic), so an interrupted or unflushed write can never leave
// the document truncated or zero-filled — and, unlike a plain temp+rename, the
// target's permission mode is preserved across the save.

const dirs: string[] = []
function tempDir(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'mt-atomic-'))
  dirs.push(d)
  return d
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

describe('writeFile — durable atomic save (#3786, #3828)', () => {
  it('overwrites an existing file and leaves no temp file behind', async() => {
    const dir = tempDir()
    const target = path.join(dir, 'note.md')
    writeFileSync(target, 'OLD')

    await writeFile(target, 'NEW', undefined)

    expect(readFileSync(target, 'utf-8')).toBe('NEW')
    // The temp file was renamed over the target — nothing left in the dir.
    expect(readdirSync(dir)).toEqual(['note.md'])
  })

  it('writes a Buffer payload (the markdown save path)', async() => {
    const dir = tempDir()
    const target = path.join(dir, 'note.md')

    await writeFile(target, Buffer.from('buffered', 'utf-8'), undefined)

    expect(readFileSync(target, 'utf-8')).toBe('buffered')
  })

  it('still recreates a missing parent directory (#3509)', async() => {
    const base = tempDir()
    const target = path.join(base, 'moved-away', 'note.md')

    await writeFile(target, 'hello', undefined)

    expect(existsSync(path.dirname(target))).toBe(true)
    expect(readFileSync(target, 'utf-8')).toBe('hello')
  })

  it.skipIf(process.platform === 'win32')(
    'preserves the target file\'s permission mode across a save',
    async() => {
      const dir = tempDir()
      const target = path.join(dir, 'secret.md')
      writeFileSync(target, 'v1')
      chmodSync(target, 0o600)

      await writeFile(target, 'v2', undefined)

      expect(readFileSync(target, 'utf-8')).toBe('v2')
      // A plain temp+rename would install a fresh 0o644 inode; write-file-atomic
      // restores the original mode.
      expect(statSync(target).mode & 0o777).toBe(0o600)
    }
  )
})
