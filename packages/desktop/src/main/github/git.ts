import fs from 'fs'
import git from 'isomorphic-git'
import http from 'isomorphic-git/http/node'

export interface GitAuthor {
  name: string
  email: string
}

export type ChangeStatus = 'modified' | 'untracked' | 'deleted' | 'added'

export interface GitChange {
  filepath: string
  status: ChangeStatus
  staged: boolean
}

// statusMatrix row = [filepath, HEAD, workdir, stage]
// HEAD:    0 = absent,        1 = present
// workdir: 0 = absent, 1 = identical to HEAD, 2 = different
// stage:   0 = absent, 1 = identical to HEAD, 2 = identical to workdir, 3 = different from both
/**
 * Compute the working-tree changes for a repo from isomorphic-git's status
 * matrix, classifying each path and whether it is staged.
 *
 * @param dir - Absolute path to the repo root.
 * @returns One entry per changed file (unchanged files are omitted).
 */
export const listChanges = async(dir: string): Promise<GitChange[]> => {
  const matrix = (await git.statusMatrix({ fs, dir })) as Array<[string, number, number, number]>
  const changes: GitChange[] = []
  for (const row of matrix) {
    const [filepath, head, workdir, stageEntry] = row
    if (head === 1 && workdir === 1 && stageEntry === 1) continue
    let status: ChangeStatus
    if (head === 0 && stageEntry !== 0) status = 'added'
    else if (head === 0) status = 'untracked'
    else if (workdir === 0) status = 'deleted'
    else status = 'modified'
    // Staged when the index differs from HEAD (stageEntry >= 2 differs from
    // workdir/HEAD baseline, or a tracked file staged for deletion).
    const staged = stageEntry >= 2 || (head === 1 && stageEntry === 0)
    changes.push({ filepath, status, staged })
  }
  return changes
}

/**
 * Stage files into the index. A path that no longer exists on disk is staged
 * as a deletion.
 *
 * @param dir - Absolute path to the repo root.
 * @param files - Repo-relative paths to stage.
 */
export const stage = async(dir: string, files: string[]): Promise<void> => {
  for (const filepath of files) {
    if (fs.existsSync(`${dir}/${filepath}`)) {
      await git.add({ fs, dir, filepath })
    } else {
      await git.remove({ fs, dir, filepath })
    }
  }
}

/**
 * Unstage files by resetting their index entry back to HEAD.
 *
 * @param dir - Absolute path to the repo root.
 * @param files - Repo-relative paths to unstage.
 */
export const unstage = async(dir: string, files: string[]): Promise<void> => {
  for (const filepath of files) {
    await git.resetIndex({ fs, dir, filepath })
  }
}

/**
 * Create a commit from the current index. Refuses when nothing is staged —
 * isomorphic-git would happily create an empty commit, which turns a
 * double-clicked Commit button into a duplicate empty commit.
 *
 * @param dir - Absolute path to the repo root.
 * @param message - Commit message.
 * @param author - Commit author (see api.commitAuthorFor).
 * @returns The new commit's oid.
 * @throws If no changes are staged.
 */
export const commit = async(dir: string, message: string, author: GitAuthor): Promise<string> => {
  const staged = (await listChanges(dir)).some((c) => c.staged)
  if (!staged) throw new Error('Nothing to commit')
  return git.commit({ fs, dir, message, author })
}

export interface RepoDetection {
  isRepo: boolean
  remoteUrl?: string
  httpsUrl?: string
}

/**
 * Normalize a github.com origin URL (https, scp-style `git@github.com:o/r`, or
 * `ssh://git@github.com/o/r`) to a canonical HTTPS URL. This is the single
 * security-relevant gate for the integration: it validates the host is exactly
 * `github.com` and the path is a well-formed `owner/repo`, and it is the URL
 * form isomorphic-git's HTTP transport + token auth actually work against.
 *
 * @param originUrl - A remote URL of any supported form.
 * @returns The canonical `https://github.com/owner/repo.git`, or null for any
 *   non-github, mishosted, or malformed origin.
 */
export const toGithubHttpsUrl = (originUrl: string): string | null => {
  const m = originUrl.match(
    /^(?:https:\/\/github\.com\/|(?:ssh:\/\/)?git@github\.com[:/])([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/
  )
  return m ? `https://github.com/${m[1]}.git` : null
}

// Read the repo's origin URL and return its canonical github HTTPS form,
// throwing if the origin is missing or not a github.com remote. Used to gate
// every authenticated network op — never trust the raw origin.
const requireGithubOrigin = async(dir: string): Promise<string> => {
  const remotes = await git.listRemotes({ fs, dir })
  const origin = remotes.find((r) => r.remote === 'origin')
  const httpsUrl = origin && toGithubHttpsUrl(origin.url)
  if (!httpsUrl) throw new Error('Not a github.com repository')
  return httpsUrl
}

/**
 * Detect whether an opened folder is a git repo with a github.com `origin`,
 * so the Source Control panel can serve any GitHub clone (not only ones cloned
 * through MarkText). SSH origins are normalized to their HTTPS equivalent so
 * isomorphic-git's http transport + token auth work regardless of clone style.
 * Root-only in v1: the folder itself must be the repo root (no upward walk).
 *
 * @param dir - Absolute path to the opened folder.
 * @returns `{ isRepo, remoteUrl?, httpsUrl? }`; `isRepo` is false for non-git
 *   folders and non-github origins.
 */
export const detectRepo = async(dir: string): Promise<RepoDetection> => {
  try {
    const remotes = await git.listRemotes({ fs, dir })
    const origin = remotes.find((r) => r.remote === 'origin')
    if (!origin) return { isRepo: false }
    const httpsUrl = toGithubHttpsUrl(origin.url)
    if (!httpsUrl) return { isRepo: false }
    return { isRepo: true, remoteUrl: origin.url, httpsUrl }
  } catch {
    return { isRepo: false }
  }
}

/**
 * Detect whether a repo uses Git LFS (isomorphic-git has no LFS support, so
 * LFS-tracked files clone as pointer files and committing would write raw
 * content). Best-effort: only the root `.gitattributes` is scanned.
 *
 * @param dir - Absolute path to the repo root.
 * @returns True if a `filter=lfs` attribute is present.
 */
export const hasLfsPatterns = async(dir: string): Promise<boolean> => {
  try {
    const attrs = await fs.promises.readFile(`${dir}/.gitattributes`, 'utf8')
    return /(^|\s)filter=lfs(\s|$)/m.test(attrs)
  } catch {
    return false
  }
}

export interface SyncResult {
  conflict: boolean
  dirty: boolean
  files: string[]
  ahead: number
  behind: number
}

export type TokenProvider = () => Promise<string | null>

// isomorphic-git calls onAuth(url, auth) when a request is challenged. Gate on
// the host so the keychain token is NEVER handed to a non-github server — a
// compromised renderer could otherwise point clone/sync at an attacker URL
// that answers 401 and receive the repo-scoped token (see the security review).
const onAuth = (getToken: TokenProvider) => async(url: string) => {
  let host: string
  try {
    host = new URL(url).host
  } catch {
    return {}
  }
  if (host !== 'github.com') return {}
  const token = await getToken()
  if (!token) throw new Error('Not authenticated with GitHub')
  // GitHub accepts the token as the username with any password.
  return { username: token, password: 'x-oauth-basic' }
}

export interface CloneProgress {
  phase: string
  loaded: number
  total: number
}

/**
 * Clone a repository (single-branch) into `dir`, authenticating with the
 * provided token and reporting progress.
 *
 * @param url - HTTPS clone URL.
 * @param dir - Absolute destination path.
 * @param getToken - Supplies the access token for `onAuth`.
 * @param onProgress - Optional progress callback (`total` normalized to 0 when unknown).
 */
export const cloneRepo = async(
  url: string,
  dir: string,
  getToken: TokenProvider,
  onProgress?: (p: CloneProgress) => void
): Promise<void> => {
  await git.clone({
    fs,
    http,
    dir,
    url,
    singleBranch: true,
    onAuth: onAuth(getToken),
    onProgress: (e) => onProgress?.({ phase: e.phase, loaded: e.loaded, total: e.total || 0 })
  })
}

/**
 * Resolve the current branch name, defaulting to `main` when detached.
 *
 * @param dir - Absolute path to the repo root.
 */
export const currentBranch = async(dir: string): Promise<string> => {
  return (await git.currentBranch({ fs, dir, fullname: false })) || 'main'
}

// isomorphic-git has no index.lock: concurrent ops on the same repo (two
// windows, or a watcher-driven status racing a commit) can corrupt the
// index. ipc.ts routes every git operation through this per-repo queue.
const repoQueues = new Map<string, Promise<unknown>>()
/**
 * Serialize operations per repo path. isomorphic-git has no `index.lock`, so
 * concurrent mutating ops on one repo (two windows, or a watcher-driven status
 * racing a commit) could corrupt the index. A rejected op does not stall the
 * queue — the next op still runs.
 *
 * @param repoPath - Repo root used as the queue key.
 * @param op - The operation to run once the repo's queue drains.
 * @returns The operation's result (rejections propagate to the caller).
 */
export const withRepoQueue = <T>(repoPath: string, op: () => Promise<T>): Promise<T> => {
  const tail = repoQueues.get(repoPath) ?? Promise.resolve()
  const run = tail.catch(() => {}).then(op)
  repoQueues.set(repoPath, run.catch(() => {}))
  return run
}

// Count commits reachable from `ref` but not from `notRef` (its merge base).
const countCommits = async(dir: string, ref: string, notRef: string): Promise<number> => {
  try {
    const base = await git.findMergeBase({
      fs,
      dir,
      oids: [
        await git.resolveRef({ fs, dir, ref }),
        await git.resolveRef({ fs, dir, ref: notRef })
      ]
    })
    const baseOid = base[0]
    const log = await git.log({ fs, dir, ref })
    let n = 0
    for (const c of log) {
      if (c.oid === baseOid) break
      n++
    }
    return n
  } catch {
    return 0
  }
}

/**
 * Merge `origin/<branch>` into the current branch. `abortOnConflict` keeps the
 * working tree untouched on conflict so it can be reported safely (v1 has no
 * in-app conflict resolution). Non-conflict errors are rethrown.
 *
 * @param dir - Absolute path to the repo root.
 * @param branch - Local branch name (also the tracked remote branch).
 * @param author - Author for the merge commit.
 * @returns Ahead/behind counts and, on overlap, `conflict: true` with the
 *   conflicted file list — never mutating the tree in that case.
 */
export const resolveAndMerge = async(
  dir: string,
  branch: string,
  author: GitAuthor
): Promise<SyncResult> => {
  const remoteRef = `refs/remotes/origin/${branch}`
  const ahead = await countCommits(dir, branch, remoteRef)
  const behind = await countCommits(dir, remoteRef, branch)
  if (behind === 0) return { conflict: false, dirty: false, files: [], ahead, behind }

  try {
    await git.merge({
      fs,
      dir,
      ours: branch,
      theirs: remoteRef,
      author,
      abortOnConflict: true
    })
    await git.checkout({ fs, dir, ref: branch })
    return { conflict: false, dirty: false, files: [], ahead, behind }
  } catch (err) {
    const e = err as { code?: string; data?: { filepaths?: string[] } }
    if (e.code === 'MergeConflictError' || e.code === 'MergeNotSupportedError') {
      return { conflict: true, dirty: false, files: e.data?.filepaths ?? [], ahead, behind }
    }
    throw err
  }
}

/**
 * Fetch the tracked remote branch (single-branch).
 *
 * @param dir - Absolute path to the repo root.
 * @param getToken - Supplies the access token for `onAuth`.
 */
export const fetchRemote = async(dir: string, getToken: TokenProvider): Promise<void> => {
  // Pass the canonical github HTTPS url explicitly so a repo cloned over SSH
  // (whose origin isomorphic-git's HTTP transport can't speak) still syncs, and
  // so we never fetch against a non-github origin.
  const url = await requireGithubOrigin(dir)
  await git.fetch({ fs, http, dir, url, singleBranch: true, onAuth: onAuth(getToken) })
}

/**
 * Push the current branch to its remote.
 *
 * @param dir - Absolute path to the repo root.
 * @param getToken - Supplies the access token for `onAuth`.
 */
export const pushBranch = async(dir: string, getToken: TokenProvider): Promise<void> => {
  const url = await requireGithubOrigin(dir)
  await git.push({ fs, http, dir, url, onAuth: onAuth(getToken) })
}

/**
 * Full sync: dirty-guard → fetch → merge (ff / clean / conflict) → push when
 * clean. The dirty guard runs before any network I/O — the renderer saves all
 * tabs first, but this is the authoritative check (spec: Sync preconditions),
 * so uncommitted work is never overwritten.
 *
 * @param dir - Absolute path to the repo root.
 * @param getToken - Supplies the access token for fetch/push.
 * @param author - Author for any merge commit.
 * @returns `{ dirty: true }` if the tree is dirty; otherwise the merge result
 *   (including `conflict: true` with files when the merge would overlap).
 */
export const sync = async(
  dir: string,
  getToken: TokenProvider,
  author: GitAuthor
): Promise<SyncResult> => {
  const dirty: SyncResult = { conflict: false, dirty: true, files: [], ahead: 0, behind: 0 }
  if ((await listChanges(dir)).length > 0) return dirty
  await fetchRemote(dir, getToken)
  // Re-check after the network window: an editor autosave may have landed
  // during the fetch (seconds on a large repo). Merging onto a now-dirty tree
  // would advance the branch ref and then fail checkout, leaving the tree at
  // pre-merge content — the next commit+push would silently revert the pull.
  if ((await listChanges(dir)).length > 0) return dirty
  const branch = await currentBranch(dir)
  const result = await resolveAndMerge(dir, branch, author)
  if (!result.conflict) {
    await pushBranch(dir, getToken)
    // After a clean merge + push, local and remote match: no pending commits.
    return { ...result, ahead: 0, behind: 0 }
  }
  return result
}
