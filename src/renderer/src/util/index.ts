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

export const animatedScrollTo = function(
  element: HTMLElement,
  to: number,
  duration: number,
  callback?: () => void
): void {
  const start = element.scrollTop
  const change = to - start
  const animationStart = +new Date()

  // Prevent animation on small steps or duration is 0
  if (Math.abs(change) <= 6 || duration === 0) {
    element.scrollTop = to
    return
  }

  const easeInOutQuad = function(t: number, b: number, c: number, d: number): number {
    t /= d / 2
    if (t < 1) return (c / 2) * t * t + b
    t--
    return (-c / 2) * (t * (t - 2) - 1) + b
  }

  const animateScroll = function(): void {
    const now = +new Date()
    const val = Math.floor(easeInOutQuad(now - animationStart, start, change, duration))

    element.scrollTop = val

    if (now > animationStart + duration) {
      element.scrollTop = to
      if (callback) {
        callback()
      }
    } else {
      requestAnimationFrame(animateScroll)
    }
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
export const isOsx = platform === 'darwin'
export const isWindows = platform === 'win32'
export const isLinux = platform === 'linux'
