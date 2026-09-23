import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// #5322: on a Windows SMB share, MoveFileEx(REPLACE_EXISTING) — what fs.rename
// compiles to, and the last step of the atomic save — is refused with
// ACCESS_DENIED (surfaced as EPERM) whenever ANY handle is open on the target.
// MarkText's own file watcher stats the open document, so a save races its own
// watcher and the edit is lost. Measured on a Windows SMB share: one open read
// handle fails 50/50 renames; watcher polling fails ~1/200 and rises with the
// stat rate. The window is short, so retrying the save clears it.

const writeFileAtomicMock = vi.fn()

vi.mock('write-file-atomic', () => ({
  default: (...args: unknown[]) => writeFileAtomicMock(...args)
}))

const { writeFile } = await import('main_renderer/filesystem')

function eperm(): NodeJS.ErrnoException {
  const error: NodeJS.ErrnoException = new Error(
    "EPERM: operation not permitted, rename 'note.md.123' -> 'note.md'"
  )
  error.code = 'EPERM'
  error.syscall = 'rename'
  return error
}

const dirs: string[] = []
function tempDir(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'mt-smb-'))
  dirs.push(d)
  return d
}

beforeEach(() => {
  writeFileAtomicMock.mockReset()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

async function runAllTimers(promise: Promise<unknown>): Promise<unknown> {
  await vi.runAllTimersAsync()
  return promise
}

describe('writeFile — a save that loses the race with an open handle (#5322)', () => {
  it('retries the rename a share refused and saves the edit', async() => {
    const target = path.join(tempDir(), 'note.md')
    writeFileAtomicMock
      .mockRejectedValueOnce(eperm())
      .mockRejectedValueOnce(eperm())
      .mockResolvedValueOnce(undefined)

    await runAllTimers(writeFile(target, 'NEW', undefined))

    expect(writeFileAtomicMock).toHaveBeenCalledTimes(3)
  })

  it('reports the failure once the retries are exhausted', async() => {
    const target = path.join(tempDir(), 'note.md')
    writeFileAtomicMock.mockRejectedValue(eperm())

    const promise = writeFile(target, 'NEW', undefined)
    const assertion = expect(promise).rejects.toThrow(/EPERM/)
    await vi.runAllTimersAsync()
    await assertion

    // Bounded: the save reports back instead of retrying forever.
    expect(writeFileAtomicMock.mock.calls.length).toBeLessThanOrEqual(5)
    expect(writeFileAtomicMock.mock.calls.length).toBeGreaterThan(1)
  })

  it('does not retry a failure that retrying cannot clear', async() => {
    const target = path.join(tempDir(), 'note.md')
    const noSpace: NodeJS.ErrnoException = new Error('ENOSPC: no space left on device')
    noSpace.code = 'ENOSPC'
    writeFileAtomicMock.mockRejectedValue(noSpace)

    const promise = writeFile(target, 'NEW', undefined)
    const assertion = expect(promise).rejects.toThrow(/ENOSPC/)
    await vi.runAllTimersAsync()
    await assertion

    expect(writeFileAtomicMock).toHaveBeenCalledTimes(1)
  })
})
