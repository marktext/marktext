export interface CancellablePromise<T> extends Promise<T> {
  cancel: () => void
}

export const delay = (time: number): CancellablePromise<void> => {
  let timerId: ReturnType<typeof setTimeout> | null
  let rejectFn: ((reason?: unknown) => void) | null
  const p = new Promise<void>((resolve, reject) => {
    rejectFn = reject
    timerId = setTimeout(() => {
      ;(p as CancellablePromise<void>).cancel = () => {}
      rejectFn = null
      resolve()
    }, time)
  }) as CancellablePromise<void>

  p.cancel = () => {
    if (timerId) clearTimeout(timerId)
    timerId = null
    if (rejectFn) rejectFn()
    rejectFn = null
  }
  return p
}

const ID_PREFIX = 'mt-'
let id = 0

export interface Cursor {
  line: number
  ch: number
}

type GetLineFn = (line: number) => string | undefined

const getNearestAvailableCursor = (
  cursor: Cursor,
  getLine: GetLineFn | undefined,
  lineCount: number
): Cursor => {
  if (typeof getLine === 'function' && lineCount > 0) {
    const currentLine = Math.min(Math.max(cursor.line, 0), lineCount - 1)
    const currentText = getLine(currentLine)

    if (typeof currentText === 'string' && /\S/.test(currentText)) {
      return {
        line: currentLine,
        ch: Math.min(cursor.ch, currentText.length)
      }
    }

    for (let distance = 1; distance < lineCount; distance++) {
      const candidates = [currentLine - distance, currentLine + distance]

      for (const lineNumber of candidates) {
        const text = getLine(lineNumber)

        if (typeof text === 'string' && /\S/.test(text)) {
          return {
            line: lineNumber,
            ch: lineNumber < currentLine ? text.length : 0
          }
        }
      }
    }
  }

  return {
    line: Math.max(cursor.line, 0),
    ch: 0
  }
}

export const adjustCursor = (
  cursor: Cursor,
  preline: string | undefined,
  line: string | undefined,
  nextline: string | undefined,
  getLine?: GetLineFn,
  lineCount = 0
): Cursor => {
  // Need to adjust the cursor when cursor is on a blank or unavailable line.
  if (typeof line !== 'string' || !/\S/.test(line)) {
    const nearestCursor = getNearestAvailableCursor(cursor, getLine, lineCount)
    const nearestLine = typeof getLine === 'function' ? getLine(nearestCursor.line) : ''
    const nearestPreLine = typeof getLine === 'function' ? getLine(nearestCursor.line - 1) : ''
    const nearestNextLine = typeof getLine === 'function' ? getLine(nearestCursor.line + 1) : ''

    if (typeof nearestLine === 'string' && /\S/.test(nearestLine)) {
      return adjustCursor(
        nearestCursor,
        nearestPreLine,
        nearestLine,
        nearestNextLine,
        getLine,
        lineCount
      )
    }

    return nearestCursor
  }

  const newCursor: Cursor = { line: cursor.line, ch: cursor.ch }
  // It's need to adjust the cursor when cursor is at begin or end in table row.
  if (/\|[^|]+\|.+\|\s*$/.test(line)) {
    if (/\|\s*:?-+:?\s*\|[:-\s|]+\|\s*$/.test(line)) {
      // cursor in `| --- | :---: |` :the second line of table
      if (typeof nextline === 'string' && /\S/.test(nextline)) {
        newCursor.line += 1 // reset the cursor to the next line
        newCursor.ch = nextline.indexOf('|') + 1
      }
    } else {
      // cursor is not at the second line to table
      if (cursor.ch <= line.indexOf('|')) newCursor.ch = line.indexOf('|') + 1
      if (cursor.ch >= line.lastIndexOf('|')) newCursor.ch = line.lastIndexOf('|') - 1
    }
  }

  // Need to adjust the cursor when cursor in the first or last line of code/math block.
  if (/```[\S]*/.test(line) || /^\$\$$/.test(line)) {
    if (typeof nextline === 'string' && /\S/.test(nextline)) {
      newCursor.line += 1
      newCursor.ch = 0
    } else if (typeof preline === 'string' && /\S/.test(preline)) {
      newCursor.line -= 1
      newCursor.ch = preline.length
    }
  }

  // Need to adjust the cursor when cursor at the begin of the list
  if (/[*+-]\s.+/.test(line) && newCursor.ch <= 1) {
    newCursor.ch = 2
  }

  return newCursor
}

const SETTLE_FRAMES = 10
// Starting a scroll animation on an element supersedes the one it runs. An
// immediate scroll does not: keeping the caret in view after a click must not
// stop the jump that click started.
const scrollAnimations = new WeakMap<HTMLElement, object>()

/** Stops the scroll animation running on `element`, before the element is scrolled another way. */
export const cancelScrollAnimation = (element: HTMLElement): void => {
  scrollAnimations.delete(element)
}

/**
 * `to` may be a function when the destination can move during the animation —
 * e.g. off-screen blocks taking their real height as they scroll into view.
 */
export const animatedScrollTo = function(
  element: HTMLElement,
  to: number | (() => number),
  duration: number,
  callback?: () => void
): void {
  const target = typeof to === 'function' ? to : () => to
  const start = element.scrollTop
  const animationStart = +new Date()

  // Prevent animation on small steps or duration is 0
  if (Math.abs(target() - start) <= 6 || duration === 0) {
    element.scrollTop = target()
    return
  }

  const token = {}
  scrollAnimations.set(element, token)
  const superseded = () => scrollAnimations.get(element) !== token

  const easeInOutQuad = function(t: number, b: number, c: number, d: number): number {
    t /= d / 2
    if (t < 1) return (c / 2) * t * t + b
    t--
    return (-c / 2) * (t * (t - 2) - 1) + b
  }

  const animateScroll = function(): void {
    if (superseded()) return
    const now = +new Date()
    const val = Math.floor(easeInOutQuad(now - animationStart, start, target() - start, duration))

    element.scrollTop = val

    if (now > animationStart + duration) {
      settle(SETTLE_FRAMES)
    } else {
      requestAnimationFrame(animateScroll)
    }
  }

  // The target can still move once it is drawn (an estimated block above it
  // takes its real height) and the scroll extent may lag a frame behind, so
  // the final position is re-applied until it holds across a frame.
  const settle = function(frames: number): void {
    element.scrollTop = target()
    requestAnimationFrame(() => {
      if (superseded()) return
      if (frames > 0 && Math.abs(element.scrollTop - target()) > 1) settle(frames - 1)
      else if (callback) callback()
    })
  }

  requestAnimationFrame(animateScroll)
}

export const getUniqueId = (): string => {
  return `${ID_PREFIX}${id++}`
}

export const hasKeys = (obj: object): boolean => Object.keys(obj).length > 0

/**
 * Shallow clone the given object.
 *
 * @param obj Object to clone
 * @param inheritFromObject Whether the clone should inherit from `Object`
 */
export const cloneObject = <T extends object>(obj: T, inheritFromObject = true): T => {
  return Object.assign(inheritFromObject ? {} : Object.create(null), obj)
}

/**
 * Deep clone the given object.
 *
 * @param obj Object to clone
 */
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj))
}

const platform =
  (typeof window !== 'undefined' &&
    window.electron &&
    window.electron.process &&
    window.electron.process.platform) ||
  ''
export const isMac = platform === 'darwin'
export const isWindows = platform === 'win32'
export const isLinux = platform === 'linux'
