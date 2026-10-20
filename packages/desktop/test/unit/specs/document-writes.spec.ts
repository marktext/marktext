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
