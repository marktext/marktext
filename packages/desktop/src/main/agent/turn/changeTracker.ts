import fs from 'fs'
import path from 'path'
import { COMMENTS_DIR } from '@shared/types/comments'
import { hashFiles, statusSnapshot } from '../repo/gitService'

interface FileState {
  xy: string
  hash: string | null
  origPath: string | null
}

type Snapshot = Map<string, FileState>

/**
 * Repo-relative POSIX path, or `null` when `filePath` leaves the repository.
 * Absolute and relative inputs are both accepted.
 */
export const repoRelativePath = (root: string, filePath: string): string | null => {
  if (filePath.length === 0 || filePath.includes('\0')) return null
  const relative = path.relative(root, path.resolve(root, filePath))
  if (
    relative.length === 0 ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) return null
  const posix = relative.split(path.sep).join('/')
  if (posix.split('/').includes('..')) return null
  return posix
}

const isCommentsPath = (filePath: string): boolean =>
  filePath === COMMENTS_DIR || filePath.startsWith(`${COMMENTS_DIR}/`)

const byPath = (left: string, right: string): number => {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

const captureSnapshot = async(root: string): Promise<Snapshot> => {
  const entries = await statusSnapshot(root)
  const snapshot: Snapshot = new Map()
  for (const entry of entries) {
    snapshot.set(entry.path, { xy: entry.xy, hash: null, origPath: entry.origPath })
  }
  const present: string[] = []
  for (const filePath of snapshot.keys()) {
    try {
      // A deleted path stays in the status with no blob to hash.
      if (fs.statSync(path.join(root, filePath)).isFile()) present.push(filePath)
    } catch {
      // The file is already gone.
    }
  }
  const hashes = await hashFiles(root, present)
  for (const item of hashes) {
    const state = snapshot.get(item.path)
    if (state) state.hash = item.hash
  }
  return snapshot
}

const rememberRename = (changed: Set<string>, state: FileState | undefined): void => {
  if (!state?.origPath || !state.xy.includes('R')) return
  changed.add(state.origPath)
}

/**
 * Snapshot differences plus ACP paths. Editor saves ACP did not name are the
 * user's own writes. `.marktext/comments/**` is never a turn change. Deletions stay.
 */
const collectChanges = (
  before: Snapshot,
  after: Snapshot,
  acp: ReadonlySet<string>,
  saved: ReadonlySet<string>
): string[] => {
  const changed = new Set<string>(acp)
  const paths = new Set<string>([...before.keys(), ...after.keys()])
  for (const filePath of paths) {
    const prev = before.get(filePath)
    const next = after.get(filePath)
    if (!next) {
      if (prev) changed.add(filePath)
      continue
    }
    if (!prev || prev.xy !== next.xy || prev.hash !== next.hash || prev.origPath !== next.origPath) {
      changed.add(filePath)
      rememberRename(changed, next)
    }
  }
  for (const filePath of [...changed]) {
    if (isCommentsPath(filePath) || (saved.has(filePath) && !acp.has(filePath))) {
      changed.delete(filePath)
    }
  }
  return [...changed].sort(byPath)
}

/**
 * Worktree difference for one turn. `open` hashes dirty files before the prompt;
 * `finish` repeats that snapshot.
 */
export class ChangeTracker {
  private readonly acp = new Set<string>()
  private readonly saved = new Set<string>()

  private constructor(
    private readonly root: string,
    private readonly before: Snapshot
  ) {}

  static open(root: string): Promise<ChangeTracker> {
    const resolved = path.resolve(root)
    return captureSnapshot(resolved).then((before) => new ChangeTracker(resolved, before))
  }

  /** Paths from ACP `locations` and diff content. A path outside the repository is ignored. */
  noteAcpPaths(paths: readonly string[]): void {
    for (const filePath of paths) this.remember(this.acp, filePath)
  }

  /** A file MarkText itself wrote during the turn. */
  noteEditorSave(pathname: string): void {
    this.remember(this.saved, pathname)
  }

  finish(): Promise<string[]> {
    return captureSnapshot(this.root).then((after) => collectChanges(this.before, after, this.acp, this.saved))
  }

  private remember(target: Set<string>, filePath: string): void {
    const relative = repoRelativePath(this.root, filePath)
    if (relative) target.add(relative)
  }
}

const trackersByWindow = new Map<number, ChangeTracker>()

export const attachChangeTracker = (windowId: number, tracker: ChangeTracker): void => {
  trackersByWindow.set(windowId, tracker)
}

export const detachChangeTracker = (windowId: number): void => {
  trackersByWindow.delete(windowId)
}

/** Save notifications are per window. A window without a turn has nothing to record. */
export const recordEditorSave = (windowId: number, pathname: string): void => {
  trackersByWindow.get(windowId)?.noteEditorSave(pathname)
}
