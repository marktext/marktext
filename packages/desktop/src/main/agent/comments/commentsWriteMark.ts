import path from 'path'

const MARK_MS = 2000
const marks = new Map<string, number>()

const keyOf = (absolutePath: string): string => path.resolve(absolutePath)

/** Remember a comments JSON path this process is about to write, so the watcher does not echo it. */
export const noteCommentsWrite = (absolutePath: string): void => {
  marks.set(keyOf(absolutePath), Date.now() + MARK_MS)
}

export const clearCommentsWrite = (absolutePath: string): void => {
  marks.delete(keyOf(absolutePath))
}

export const isOwnCommentsWrite = (absolutePath: string): boolean => {
  const key = keyOf(absolutePath)
  const expires = marks.get(key)
  if (expires == null) return false
  if (Date.now() > expires) {
    marks.delete(key)
    return false
  }
  return true
}
