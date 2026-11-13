type Axis = 'x' | 'y'

interface ScrollTarget {
  element: HTMLElement
  axis: Axis
  delta: number
  minimum: number
  maximum: number
}

const findScrollTarget = (
  elements: HTMLElement[], axis: Axis, delta: number, mode: number, root: Element | null
): ScrollTarget | undefined => {
  if (delta === 0) return

  for (const element of elements) {
    const style = getComputedStyle(element)
    const overflow = (axis === 'x' ? style.overflowX : style.overflowY) || style.overflow
    const isRoot = element === root && !/hidden|clip/.test(overflow)
    if (!isRoot && !/^(auto|scroll|overlay)$/.test(overflow)) continue

    const size = axis === 'x' ? element.clientWidth : element.clientHeight
    const extent = axis === 'x' ? element.scrollWidth : element.scrollHeight
    const position = axis === 'x' ? element.scrollLeft : element.scrollTop
    const rtl = axis === 'x' && style.direction === 'rtl'
    const minimum = rtl ? -Math.max(0, extent - size) : 0
    const maximum = rtl ? 0 : Math.max(0, extent - size)
    const canScroll = delta < 0 ? position > minimum : position < maximum

    if (canScroll) {
      let unit = 1
      if (mode === WheelEvent.DOM_DELTA_LINE) {
        unit = parseFloat(style.lineHeight) || (parseFloat(style.fontSize) || 16) * 1.2
      } else if (mode === WheelEvent.DOM_DELTA_PAGE) {
        unit = size
      }
      return { element, axis, delta: delta * unit, minimum, maximum }
    }

    const overscroll = (axis === 'x' ? style.overscrollBehaviorX : style.overscrollBehaviorY) || style.overscrollBehavior
    if (overscroll === 'contain' || overscroll === 'none') {
      return { element, axis, delta: 0, minimum, maximum }
    }
  }
}

// Chromium's wheel animation has no live toggle. Intercept only while disabled
// so the enabled preference retains the platform's native input behavior.
export const installInstantWheelScrolling = (document: Document): (() => void) => {
  const remainders = new WeakMap<HTMLElement, Partial<Record<Axis, number>>>()

  const onWheel = (event: WheelEvent): void => {
    if (event.defaultPrevented || !event.cancelable || event.ctrlKey || event.metaKey) return
    if (event.target instanceof Element && event.target.closest('input, select')) return

    const elements = event.composedPath().filter((element): element is HTMLElement => element instanceof HTMLElement)
    const horizontal = event.shiftKey && event.deltaX === 0
    const x = findScrollTarget(elements, 'x', horizontal ? event.deltaY : event.deltaX, event.deltaMode, document.scrollingElement)
    const y = findScrollTarget(elements, 'y', horizontal ? 0 : event.deltaY, event.deltaMode, document.scrollingElement)
    const targets = [x, y].filter((target): target is ScrollTarget => target !== undefined)
    if (targets.length === 0) return

    event.preventDefault()
    for (const { element, axis, delta, minimum, maximum } of targets) {
      if (delta === 0) continue
      const remainder = remainders.get(element) ?? {}
      const position = axis === 'x' ? element.scrollLeft : element.scrollTop
      const destination = Math.max(minimum, Math.min(maximum, position + delta + (remainder[axis] ?? 0)))
      element.scrollTo({ [axis === 'x' ? 'left' : 'top']: destination, behavior: 'instant' })
      // Some platforms round scroll offsets to whole pixels; retain subpixel input.
      remainder[axis] = destination - (axis === 'x' ? element.scrollLeft : element.scrollTop)
      remainders.set(element, remainder)
    }
  }

  document.addEventListener('wheel', onWheel, { passive: false })
  return () => document.removeEventListener('wheel', onWheel)
}
