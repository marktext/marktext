import { execFile, type ExecFileException } from 'child_process'
import path from 'path'
import { HUMAN_FALLBACK_NAME } from '@shared/types/comments'

const GIT_EXEC_TIMEOUT_MS = 30_000
const GIT_MAX_BUFFER_BYTES = 64 * 1024 * 1024
/** Unified patch returned to the renderer. Longer output is cut on a UTF-8 boundary. */
export const DIFF_PATCH_MAX_BYTES = 5 * 1024 * 1024

/** The diff channel was asked for a window that has no repository. */
export class GitDiffError extends Error {
  readonly code = 'no_repo' as const

  constructor(message = 'the window has no repository') {
    super(message)
    this.name = 'GitDiffError'
  }
}

/**
 * `git` missing from `PATH` (`git_not_found`). Any other failure is `git_failed`.
 * `status` is the process exit code when git ran, and `null` when it did not (missing binary, timeout).
 */
export class GitCommandError extends Error {
  readonly code: 'git_not_found' | 'git_failed'
  readonly status: number | null

  constructor(code: 'git_not_found' | 'git_failed', message: string, status: number | null = null) {
    super(message)
    this.name = 'GitCommandError'
    this.code = code
    this.status = status
  }
}

export const isGitCommandError = (error: unknown): error is GitCommandError =>
  error instanceof GitCommandError

/**
 * One porcelain v1 record. `origPath` is set for a rename or a copy:
 * git prints the current path in the status field and the previous path in the next NUL field
 * (the opposite of the `ORIG -> DEST` text form).
 */
export interface GitStatusEntry {
  xy: string
  path: string
  origPath: string | null
}

export interface GitFileHash {
  path: string
  hash: string
}

interface GitExecOptions {
  /** Written to stdin, then the pipe is closed. */
  input?: string
  /** Non-zero exits that still return stdout. `diff --no-index` uses 1 for a real difference. */
  acceptStatus?: readonly number[]
}

const nullDevice = (): string => process.platform === 'win32' ? 'NUL' : '/dev/null'

const toRepoPath = (value: string): string => value.replace(/\\/g, '/')

const isRenameOrCopy = (xy: string): boolean =>
  xy[0] === 'R' || xy[0] === 'C' || xy[1] === 'R' || xy[1] === 'C'

const execGit = (cwd: string, args: string[], options: GitExecOptions = {}): Promise<string> =>
  new Promise((resolve, reject) => {
    const child = execFile('git', args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: GIT_MAX_BUFFER_BYTES,
      timeout: GIT_EXEC_TIMEOUT_MS,
      windowsHide: true
    }, (error: ExecFileException | null, stdout: string, stderr: string) => {
      if (!error) {
        resolve(stdout)
        return
      }
      if (error.code === 'ENOENT') {
        reject(new GitCommandError('git_not_found', 'git was not found on PATH'))
        return
      }
      if (typeof error.code === 'number' && options.acceptStatus?.includes(error.code)) {
        resolve(stdout ?? '')
        return
      }
      const detail = (stderr || error.message).trim()
      const status = typeof error.code === 'number' ? error.code : null
      reject(new GitCommandError('git_failed', detail, status))
    })
    // Commands that never read stdin still block if the pipe stays open.
    // EPIPE (git exited first) must not surface as an unhandled stream error.
    const stdin = child.stdin
    if (stdin) {
      stdin.on('error', () => {})
      stdin.end(options.input ?? '')
    }
  })

const normalizeRepoRoot = (raw: string): string => {
  const trimmed = raw.trim()
  if (process.platform === 'win32') return path.win32.normalize(trimmed)
  return path.resolve(trimmed)
}

/**
 * Absolute worktree root, or `null` when `dir` is not inside a repository.
 * On Windows the path is in native form.
 */
export const getRepoRoot = async(dir: string): Promise<string | null> => {
  try {
    const stdout = await execGit(dir, ['rev-parse', '--show-toplevel'])
    return normalizeRepoRoot(stdout)
  } catch (error) {
    // `rev-parse --show-toplevel` exits 128 outside a work tree. The text is localized.
    if (isGitCommandError(error) && error.code === 'git_failed' && error.status === 128) {
      return null
    }
    throw error
  }
}

/** `git config user.name`, or `me` when the value is unset or blank. */
export const getUserName = async(root: string): Promise<string> => {
  try {
    const name = (await execGit(root, ['config', 'user.name'])).trim()
    return name || HUMAN_FALLBACK_NAME
  } catch (error) {
    if (isGitCommandError(error) && error.code === 'git_not_found') throw error
    return HUMAN_FALLBACK_NAME
  }
}

const parseStatusZ = (stdout: string): GitStatusEntry[] => {
  const parts = stdout.split('\0')
  const entries: GitStatusEntry[] = []
  let index = 0
  while (index < parts.length) {
    const head = parts[index]
    if (!head) break
    if (head.length < 4 || head[2] !== ' ') {
      throw new GitCommandError('git_failed', 'unrecognized git status record')
    }
    const xy = head.slice(0, 2)
    const filePath = toRepoPath(head.slice(3))
    if (isRenameOrCopy(xy)) {
      const orig = parts[index + 1]
      if (!orig) throw new GitCommandError('git_failed', 'truncated git status rename record')
      entries.push({ xy, path: filePath, origPath: toRepoPath(orig) })
      index += 2
      continue
    }
    entries.push({ xy, path: filePath, origPath: null })
    index += 1
  }
  return entries
}

/** Worktree status, including untracked files and renames. Paths are POSIX-relative. */
export const statusSnapshot = async(root: string): Promise<GitStatusEntry[]> => {
  const stdout = await execGit(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all'])
  return parseStatusZ(stdout)
}

/** Blob hashes in the same order as `paths`. An empty list does not invoke git. */
export const hashFiles = async(root: string, paths: readonly string[]): Promise<GitFileHash[]> => {
  if (paths.length === 0) return []
  const stdout = await execGit(root, ['hash-object', '--stdin-paths'], {
    input: `${paths.join('\n')}\n`
  })
  const hashes = stdout.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  if (hashes.length !== paths.length) {
    throw new GitCommandError('git_failed', 'git hash-object returned an unexpected number of hashes')
  }
  return paths.map((filePath, index) => ({ path: filePath, hash: hashes[index] ?? '' }))
}

/**
 * `HEAD` when the repo has a commit; otherwise the empty tree from
 * `git hash-object -t tree` of the null device (a repo with no commits has no `HEAD`).
 */
const diffBase = async(root: string): Promise<string> => {
  try {
    const hash = (await execGit(root, ['rev-parse', '--verify', '--quiet', 'HEAD'])).trim()
    if (hash.length > 0) return 'HEAD'
  } catch (error) {
    if (isGitCommandError(error) && error.code === 'git_not_found') throw error
  }
  const tree = (await execGit(root, ['hash-object', '-t', 'tree', nullDevice()])).trim()
  if (!tree) throw new GitCommandError('git_failed', 'git did not return an empty tree hash')
  return tree
}

const joinPatches = (parts: string[]): string =>
  parts.filter(part => part.length > 0).map(part => part.endsWith('\n') ? part : `${part}\n`).join('')

export interface GitDiffPatch {
  patch: string
  /** Set when `patch` is only the first `DIFF_PATCH_MAX_BYTES` of the full diff. */
  truncated?: true
}

const utf8Width = (lead: number): number => {
  if ((lead & 0x80) === 0) return 1
  if ((lead & 0xe0) === 0xc0) return 2
  if ((lead & 0xf0) === 0xe0) return 3
  if ((lead & 0xf8) === 0xf0) return 4
  return 1
}

/** Keeps a leading prefix that is valid UTF-8 and no longer than `limit` bytes. */
export const clipPatch = (patch: string, limit = DIFF_PATCH_MAX_BYTES): GitDiffPatch => {
  const bytes = Buffer.from(patch, 'utf8')
  if (bytes.length <= limit) return { patch }
  let end = limit
  let lead = end - 1
  while (lead >= 0 && ((bytes[lead] ?? 0) & 0xc0) === 0x80) lead -= 1
  const leadByte = lead >= 0 ? bytes[lead] : undefined
  if (leadByte !== undefined && lead + utf8Width(leadByte) > limit) end = lead
  return { patch: bytes.subarray(0, end).toString('utf8'), truncated: true }
}

/**
 * Diff against `HEAD` (or the empty tree when there is no commit).
 * Exit code 1 is a difference, not a failure.
 * Untracked paths are omitted by `git diff`, so each one is compared with
 * `diff --no-index` against the null device (`NUL` on Windows).
 * Omitting `paths` diffs the whole worktree: tracked changes plus every
 * untracked file from `status` (ignored paths are not in that list).
 */
export const diffHead = async(root: string, paths?: readonly string[]): Promise<string> => {
  const base = await diffBase(root)
  const diffArgs = (pathspecs: readonly string[]): string[] => {
    const args = ['diff', '--no-color', '--no-ext-diff', base]
    if (pathspecs.length > 0) args.push('--', ...pathspecs)
    return args
  }
  if (paths === undefined) {
    const untracked = (await statusSnapshot(root))
      .filter(entry => entry.xy === '??')
      .map(entry => entry.path)
    const trackedPatch = await execGit(root, diffArgs([]), { acceptStatus: [1] })
    const parts = [trackedPatch]
    for (const filePath of untracked) {
      parts.push(await execGit(root, [
        'diff', '--no-color', '--no-ext-diff', '--no-index', '--', nullDevice(), filePath
      ], { acceptStatus: [1] }))
    }
    return joinPatches(parts)
  }
  if (paths.length === 0) return ''

  const untracked = new Set(
    (await statusSnapshot(root)).filter(entry => entry.xy === '??').map(entry => entry.path)
  )
  const tracked: string[] = []
  const extra: string[] = []
  for (const filePath of paths) {
    const repoPath = toRepoPath(filePath)
    if (untracked.has(repoPath)) extra.push(repoPath)
    else tracked.push(repoPath)
  }

  const parts: string[] = []
  if (tracked.length > 0) {
    parts.push(await execGit(root, diffArgs(tracked), { acceptStatus: [1] }))
  }
  for (const filePath of extra) {
    parts.push(await execGit(root, [
      'diff', '--no-color', '--no-ext-diff', '--no-index', '--', nullDevice(), filePath
    ], { acceptStatus: [1] }))
  }
  return joinPatches(parts)
}

/** `diffHead`, then the 5 MB cap the diff panel shows. */
export const worktreeDiff = async(root: string, paths?: readonly string[]): Promise<GitDiffPatch> =>
  clipPatch(await diffHead(root, paths))
