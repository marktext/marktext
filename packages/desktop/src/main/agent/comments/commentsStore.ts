import { randomUUID } from 'crypto'
import { rename, mkdir, readFile, readdir, rm, rmdir, writeFile } from 'fs/promises'
import path from 'path'
import {
  COMMENTS_DIR,
  COMMENTS_FILE_VERSION,
  isCommentsFile,
  serializeCommentsFile,
  type CommentsFile,
  type CommentsLoadResult
} from '@shared/types/comments'

/** A markdown path left the repository, or a conflicted comments file was not overwritten. */
export class CommentsStoreError extends Error {
  readonly code: 'comments_path' | 'comments_write_blocked'
  readonly filePath: string | null

  constructor(
    code: 'comments_path' | 'comments_write_blocked',
    message: string,
    filePath: string | null = null
  ) {
    super(message)
    this.name = 'CommentsStoreError'
    this.code = code
    this.filePath = filePath
  }
}

const emptyFile = (mdRelPath: string): CommentsFile => ({
  version: COMMENTS_FILE_VERSION,
  file: mdRelPath,
  threads: []
})

const commentsRootOf = (root: string): string => path.resolve(root, COMMENTS_DIR)

const isStrictDescendant = (parent: string, child: string): boolean => {
  const relative = path.relative(parent, child)
  return relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative)
}

/**
 * Absolute path of the comments JSON for a repository-relative markdown file.
 * `docs/guide.md` is stored at `<root>/.marktext/comments/docs/guide.md.json`.
 * Absolute paths and `..` throw `comments_path`.
 */
export const pathFor = (root: string, mdRelPath: string): string => {
  if (
    mdRelPath.length === 0 ||
    mdRelPath.includes('\0') ||
    mdRelPath.includes('\\') ||
    path.posix.isAbsolute(mdRelPath) ||
    path.win32.isAbsolute(mdRelPath) ||
    /^[A-Za-z]:/.test(mdRelPath)
  ) {
    throw new CommentsStoreError('comments_path', 'markdown path must be relative to the repository')
  }
  const segments = mdRelPath.split('/')
  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
    throw new CommentsStoreError('comments_path', 'markdown path must stay inside the repository')
  }

  const commentsRoot = commentsRootOf(root)
  const target = path.resolve(commentsRoot, `${mdRelPath}.json`)
  if (!isStrictDescendant(commentsRoot, target)) {
    throw new CommentsStoreError('comments_path', 'markdown path must stay inside the repository')
  }
  return target
}

/** Markdown path stored in a comments JSON file, or null when `absolutePath` is not one. */
export const markdownPathFromStoreFile = (absolutePath: string): string | null => {
  const normalized = absolutePath.replace(/\\/g, '/')
  const marker = `/${COMMENTS_DIR}/`
  const index = normalized.lastIndexOf(marker)
  if (index < 0 || !normalized.endsWith('.json')) return null
  const relative = normalized.slice(index + marker.length, -'.json'.length)
  if (relative.length === 0) return null
  const segments = relative.split('/')
  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) return null
  return relative
}

const readResult = async(mdRelPath: string, filePath: string): Promise<CommentsLoadResult> => {
  let text: string
  try {
    text = await readFile(filePath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { kind: 'ok', file: emptyFile(mdRelPath) }
    }
    throw error
  }

  if (text.includes('<<<<<<<')) {
    return { kind: 'parse_error', path: filePath, message: 'conflict marker' }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid JSON'
    return { kind: 'parse_error', path: filePath, message }
  }
  if (!isCommentsFile(parsed) || parsed.file !== mdRelPath) {
    return { kind: 'parse_error', path: filePath, message: 'comments file does not match the schema' }
  }
  return { kind: 'ok', file: parsed }
}

/** Missing file is an empty `CommentsFile`. Invalid JSON or a conflict marker is `parse_error`. */
export const load = async(root: string, mdRelPath: string): Promise<CommentsLoadResult> => {
  const filePath = pathFor(root, mdRelPath)
  return readResult(mdRelPath, filePath)
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

// A Windows rename over an open file fails with EPERM or EBUSY until that handle
// drops. The same gaps as a document save clear a short-lived stat.
const RENAME_RETRY_DELAYS_MS = [50, 75, 50]

const renameOver = async(from: string, to: string): Promise<void> => {
  const retries = process.platform === 'win32' ? RENAME_RETRY_DELAYS_MS : []
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(from, to)
      return
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      const retry = process.platform === 'win32' && (code === 'EPERM' || code === 'EBUSY')
      if (!retry || attempt >= retries.length) throw error
      await delay(retries[attempt])
    }
  }
}

const atomicWrite = async(filePath: string, content: string): Promise<void> => {
  const directory = path.dirname(filePath)
  await mkdir(directory, { recursive: true })
  const tmp = path.join(directory, `.${path.basename(filePath)}.${randomUUID()}.tmp`)
  try {
    await writeFile(tmp, content, 'utf8')
    await renameOver(tmp, filePath)
  } catch (error) {
    await rm(tmp, { force: true })
    throw error
  }
}

const pruneEmptyDirs = async(commentsRoot: string, startDir: string): Promise<void> => {
  let dir = path.resolve(startDir)
  const root = path.resolve(commentsRoot)
  while (isStrictDescendant(root, dir)) {
    let names: string[]
    try {
      names = await readdir(dir)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }
    if (names.length > 0) return
    try {
      await rmdir(dir)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ENOENT' || code === 'ENOTEMPTY' || code === 'EEXIST') return
      throw error
    }
    dir = path.dirname(dir)
  }
}

/**
 * Writes `file` with `serializeCommentsFile`. A file that `load` reports as
 * `parse_error` is left untouched. An empty thread list removes the JSON file
 * and empty directories under `.marktext/comments` (that directory itself stays).
 */
export const save = async(root: string, file: CommentsFile): Promise<void> => {
  const filePath = pathFor(root, file.file)
  const current = await readResult(file.file, filePath)
  if (current.kind === 'parse_error') {
    throw new CommentsStoreError('comments_write_blocked', current.message, filePath)
  }

  if (file.threads.length === 0) {
    await rm(filePath, { force: true })
    await pruneEmptyDirs(commentsRootOf(root), path.dirname(filePath))
    return
  }

  await atomicWrite(filePath, serializeCommentsFile(file))
}
