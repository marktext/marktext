import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { animatedScrollTo } from '@/util'

let callbacks: Map<number, FrameRequestCallback>
let nextFrame: number

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
  callbacks = new Map()
  nextFrame = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = ++nextFrame
    callbacks.set(id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function frame(time: number): void {
  vi.setSystemTime(time)
  const scheduled = [...callbacks.values()]
  callbacks.clear()
  for (const callback of scheduled) callback(time)
}

describe('animatedScrollTo', () => {
  it.each([[100, 0], [4, 300], [0, 300]])('completes an immediate scroll to %s with duration %s', (to, duration) => {
    const element = document.createElement('div')
    const complete = vi.fn()
    animatedScrollTo(element, to, duration, complete)
    expect(element.scrollTop).toBe(to)
    expect(complete).toHaveBeenCalledOnce()
    expect(callbacks.size).toBe(0)
  })

  it('a newer destination replaces an in-flight animation without jumping back', () => {
    const element = document.createElement('div')
    const superseded = vi.fn()
    animatedScrollTo(element, 100, 300, superseded)
    frame(150)
    expect(element.scrollTop).toBe(50)
    animatedScrollTo(element, 250, 300)
    frame(300)
    expect(element.scrollTop).toBe(150)
    frame(450)
    expect(element.scrollTop).toBe(250)
    expect(superseded).not.toHaveBeenCalled()
    expect(callbacks.size).toBe(0)
  })

  it('an immediate find jump cancels an old smooth scroll', () => {
    const element = document.createElement('div')
    animatedScrollTo(element, 100, 300)
    frame(100)
    animatedScrollTo(element, 500, 0)
    frame(400)
    expect(element.scrollTop).toBe(500)
    expect(callbacks.size).toBe(0)
  })

  it('keeps animations on separate editor containers independent', () => {
    const first = document.createElement('div')
    const second = document.createElement('div')
    const complete = vi.fn()
    animatedScrollTo(first, 100, 300)
    animatedScrollTo(second, 200, 300, complete)
    animatedScrollTo(first, 500, 0)
    frame(300)
    expect(first.scrollTop).toBe(500)
    expect(second.scrollTop).toBe(200)
    expect(complete).toHaveBeenCalledOnce()
  })
})
