import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installInstantWheelScrolling } from '@/util/instantWheelScrolling'

let uninstall: () => void

beforeEach(() => {
  uninstall = installInstantWheelScrolling(document)
})

afterEach(() => {
  uninstall()
  document.body.replaceChildren()
})

const scrollable = (parent: HTMLElement = document.body): HTMLElement => {
  const element = document.createElement('div')
  element.style.overflowX = 'auto'
  element.style.overflowY = 'auto'
  element.style.lineHeight = '24px'
  Object.defineProperties(element, {
    clientWidth: { value: 200 }, clientHeight: { value: 100 },
    scrollWidth: { value: 600 }, scrollHeight: { value: 1000 }
  })
  element.scrollTo = vi.fn((options?: ScrollToOptions | number, y?: number) => {
    const target = typeof options === 'number' ? { left: options, top: y } : options ?? {}
    if (target.top !== undefined) element.scrollTop = Math.round(target.top)
    if (target.left !== undefined) element.scrollLeft = Math.round(target.left)
  })
  parent.append(element)
  return element
}

const wheel = (element: HTMLElement, init: WheelEventInit = {}): WheelEvent => {
  const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120, ...init })
  element.dispatchEvent(event)
  return event
}

describe('instant wheel scrolling', () => {
  it('scrolls the nearest container immediately and stops intercepting when restored', () => {
    const element = scrollable()
    const child = document.createElement('span')
    element.append(child)
    expect(wheel(child).defaultPrevented).toBe(true)
    expect(element.scrollTop).toBe(120)
    expect(element.scrollTo).toHaveBeenCalledWith({ top: 120, behavior: 'instant' })
    uninstall()
    expect(wheel(child).defaultPrevented).toBe(false)
    expect(element.scrollTop).toBe(120)
  })

  it('chains to an ancestor at a nested boundary and keeps horizontal scrolling local', () => {
    const outer = scrollable()
    const inner = scrollable(outer)
    inner.scrollTop = 900
    wheel(inner, { deltaX: 40, deltaY: 120 })
    expect(inner.scrollTop).toBe(900)
    expect(inner.scrollLeft).toBe(40)
    expect(outer.scrollTop).toBe(120)
    wheel(inner, { deltaY: -80 })
    expect(inner.scrollTop).toBe(820)
    expect(outer.scrollTop).toBe(120)
  })

  it.each(['contain', 'none'])('respects overscroll-behavior: %s', behavior => {
    const outer = scrollable()
    const inner = scrollable(outer)
    inner.style.overscrollBehaviorY = behavior
    inner.scrollTop = 900
    expect(wheel(inner).defaultPrevented).toBe(true)
    expect(outer.scrollTop).toBe(0)
  })

  it('skips non-scrollable overflow without disabling its parent', () => {
    const outer = scrollable()
    const inner = scrollable(outer)
    inner.style.overflowY = 'hidden'
    wheel(inner)
    expect(inner.scrollTop).toBe(0)
    expect(outer.scrollTop).toBe(120)
  })

  it('maps shift-wheel to horizontal scrolling', () => {
    const element = scrollable()
    wheel(element, { shiftKey: true })
    expect(element.scrollLeft).toBe(120)
    expect(element.scrollTop).toBe(0)
  })

  it('supports negative horizontal offsets in RTL containers', () => {
    const element = scrollable()
    element.style.direction = 'rtl'
    wheel(element, { deltaX: -120, deltaY: 0 })
    expect(element.scrollLeft).toBe(-120)
    wheel(element, { deltaX: 40, deltaY: 0 })
    expect(element.scrollLeft).toBe(-80)
  })

  it.each([[WheelEvent.DOM_DELTA_LINE, 48], [WheelEvent.DOM_DELTA_PAGE, 200]])('converts delta mode %s to pixels', (deltaMode, expected) => {
    const element = scrollable()
    wheel(element, { deltaY: 2, deltaMode })
    expect(element.scrollTop).toBe(expected)
  })

  it('accumulates fractional trackpad deltas when the platform rounds offsets', () => {
    const element = scrollable()
    for (let i = 0; i < 10; i++) wheel(element, { deltaY: 0.2 })
    expect(element.scrollTop).toBe(2)
  })

  it.each([{ ctrlKey: true }, { metaKey: true }, { cancelable: false }])('preserves zoom gestures and uncancelable events: %j', init => {
    const element = scrollable()
    expect(wheel(element, init).defaultPrevented).toBe(false)
    expect(element.scrollTop).toBe(0)
  })

  it('leaves wheel events owned by another control alone', () => {
    const element = scrollable()
    element.addEventListener('wheel', event => event.preventDefault())
    wheel(element)
    expect(element.scrollTop).toBe(0)
    expect(element.scrollTo).not.toHaveBeenCalled()
  })

  it.each(['input', 'select'])('preserves native %s controls', tag => {
    const element = scrollable()
    const control = document.createElement(tag)
    element.append(control)
    expect(wheel(control).defaultPrevented).toBe(false)
    expect(element.scrollTop).toBe(0)
  })

  it('leaves events with no available scroll target untouched', () => {
    expect(wheel(document.body).defaultPrevented).toBe(false)
    const element = scrollable()
    element.scrollTop = 900
    expect(wheel(element).defaultPrevented).toBe(false)
  })
})
