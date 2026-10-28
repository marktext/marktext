import { describe, expect, it, vi } from 'vitest'
import { DocumentWriteCoordinator } from '../../../src/main/filesystem/documentWrites'

describe('document write barriers', () => {
  it('waits for active writes and cancels queued and stale writes before acknowledging the lock', async() => {
    const writes = new DocumentWriteCoordinator()
    let finish!: () => void
    const active = writes.write(
      1,
      'a',
      0,
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    await Promise.resolve()
    const queued = vi.fn(async() => true)
    const pending = writes.write(1, 'a', 0, queued)
    let locked = false
    const lock = writes.setReadOnly(1, 'a', true).then(() => {
      locked = true
    })
    await Promise.resolve()
    expect(locked).toBe(false)
    expect(writes.capture(1, 'a')).toBeNull()
    finish()
    await Promise.all([active, pending, lock])
    expect(locked).toBe(true)
    expect(queued).not.toHaveBeenCalled()
    await writes.setReadOnly(1, 'a', false)
    await writes.write(1, 'a', 0, queued)
    expect(queued).not.toHaveBeenCalled()
    await writes.write(1, 'a', writes.capture(1, 'a')!, queued)
    expect(queued).toHaveBeenCalledOnce()
  })

  it('keeps tab and window policies independent, including after a failed write', async() => {
    const writes = new DocumentWriteCoordinator()
    await writes.setReadOnly(1, 'a', true)
    expect(writes.capture(1, 'a')).toBeNull()
    expect(writes.capture(2, 'a')).toBe(0)
    expect(writes.capture(1, 'b')).toBe(0)
    await expect(
      writes.write(1, 'b', 0, async() => {
        throw new Error('disk full')
      })
    ).rejects.toThrow('disk full')
    await writes.setReadOnly(1, 'b', true)
    writes.forget(1, 'b')
    expect(writes.capture(1, 'b')).toBeNull()
    const lateWrite = vi.fn(async() => true)
    await writes.write(1, 'b', 0, lateWrite)
    expect(lateWrite).not.toHaveBeenCalled()
    writes.clearOwner(1)
    expect(writes.capture(1, 'a')).toBe(0)
  })
})

it('blocks file-move writes without undoing a concurrent reading-mode change', async() => {
  const writes = new DocumentWriteCoordinator()
  const epoch = writes.capture(1, 'file')!
  await writes.withBlockedWrites(1, ['file'], async() => {
    expect(writes.capture(1, 'file')).toBeNull()
    const write = vi.fn(async() => 'must not write')
    expect(await writes.write(1, 'file', epoch, write)).toBeUndefined()
    expect(write).not.toHaveBeenCalled()
    await writes.setReadOnly(1, 'file', true)
  })
  expect(writes.capture(1, 'file')).toBeNull()
  await writes.setReadOnly(1, 'file', false)
  expect(writes.capture(1, 'file')).not.toBeNull()
})

it('keeps overlapping move barriers blocked until both operations finish', async() => {
  const writes = new DocumentWriteCoordinator()
  let finish: (() => void) | undefined
  const waiting = new Promise<void>((resolve) => {
    finish = resolve
  })
  const first = writes.withBlockedWrites(1, ['file'], () => waiting)
  await writes.withBlockedWrites(1, ['file'], async() => {})
  expect(writes.capture(1, 'file')).toBeNull()
  finish?.()
  await first
  expect(writes.capture(1, 'file')).not.toBeNull()
})
