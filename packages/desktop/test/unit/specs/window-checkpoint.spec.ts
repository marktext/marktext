import { afterEach, expect, it, vi } from 'vitest'

const { getSessionActions } = vi.hoisted(() => ({ getSessionActions: vi.fn() }))
vi.mock('@/store/editor', () => ({ getSessionActions }))
import { requestWindowCheckpoint, scheduleWindowCheckpoint } from '@/store/checkpoint'

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.clearAllMocks()
})

it('queues persistence through the session owner without starting a second timer', () => {
  vi.useFakeTimers()
  const queue = vi.fn()
  getSessionActions.mockReturnValue({ scheduleCheckpoint: queue, checkpoint: vi.fn() })
  scheduleWindowCheckpoint()
  scheduleWindowCheckpoint()
  expect(queue).toHaveBeenCalledTimes(2)
  expect(vi.getTimerCount()).toBe(0)
})

it('awaits an immediate checkpoint through the same owner', async() => {
  const result = { status: 'persisted' }
  const checkpoint = vi.fn(async() => result)
  getSessionActions.mockReturnValue({ checkpoint, scheduleCheckpoint: vi.fn() })
  expect(await requestWindowCheckpoint('close-transaction')).toBe(result)
  expect(checkpoint).toHaveBeenCalledExactlyOnceWith('close-transaction')
})

it('does not write state before a session exists', async() => {
  getSessionActions.mockReturnValue(null)
  scheduleWindowCheckpoint()
  expect(await requestWindowCheckpoint()).toBe(false)
})
