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

export const stage = async(dir: string, files: string[]): Promise<void> => {
  for (const filepath of files) {
    if (fs.existsSync(`${dir}/${filepath}`)) {
      await git.add({ fs, dir, filepath })
    } else {
      await git.remove({ fs, dir, filepath })
    }
  }
}

export const unstage = async(dir: string, files: string[]): Promise<void> => {
  for (const filepath of files) {
    await git.resetIndex({ fs, dir, filepath })
  }
}

export const commit = async(dir: string, message: string, author: GitAuthor): Promise<string> => {
  return git.commit({ fs, dir, message, author })
}

export interface RepoDetection {
  isRepo: boolean
  remoteUrl?: string
  httpsUrl?: string
}

// The Source Control panel serves any opened folder whose origin points at
// github.com — not only repos cloned through MarkText. SSH origins are
// rewritten to their HTTPS equivalent so isomorphic-git's http transport and
// token auth work regardless of how the repo was cloned. Root-only in v1:
// the opened folder itself must be the repo root (no upward walk).
export const detectRepo = async(dir: string): Promise<RepoDetection> => {
  try {
    const remotes = await git.listRemotes({ fs, dir })
    const origin = remotes.find((r) => r.remote === 'origin')
    if (!origin) return { isRepo: false }
    const m = origin.url.match(/^(?:https:\/\/github\.com\/|git@github\.com:)(.+?)(?:\.git)?$/)
    if (!m) return { isRepo: false }
    return { isRepo: true, remoteUrl: origin.url, httpsUrl: `https://github.com/${m[1]}.git` }
  } catch {
    return { isRepo: false }
  }
}

// isomorphic-git has no LFS support: LFS-tracked files clone as pointer files
// and committing them writes raw content. Detect so the panel can warn.
// Best-effort: only the root .gitattributes is scanned.
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

const onAuth = (getToken: TokenProvider) => async() => {
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

export const currentBranch = async(dir: string): Promise<string> => {
  return (await git.currentBranch({ fs, dir, fullname: false })) || 'main'
}

// isomorphic-git has no index.lock: concurrent ops on the same repo (two
// windows, or a watcher-driven status racing a commit) can corrupt the
// index. ipc.ts routes every git operation through this per-repo queue.
const repoQueues = new Map<string, Promise<unknown>>()
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

// Merge origin/<branch> into the current branch. abortOnConflict keeps the
// working tree untouched on conflict so we can report it safely (v1: no
// in-app resolution).
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

export const fetchRemote = async(dir: string, getToken: TokenProvider): Promise<void> => {
  await git.fetch({ fs, http, dir, singleBranch: true, onAuth: onAuth(getToken) })
}

export const pushBranch = async(dir: string, getToken: TokenProvider): Promise<void> => {
  await git.push({ fs, http, dir, onAuth: onAuth(getToken) })
}

// Full sync: dirty-guard → fetch → merge (ff / clean / conflict) → push when
// clean. The dirty guard runs before any network I/O: the renderer save-alls
// first, but main is the authoritative check (spec: Sync preconditions).
export const sync = async(
  dir: string,
  getToken: TokenProvider,
  author: GitAuthor
): Promise<SyncResult> => {
  if ((await listChanges(dir)).length > 0) {
    return { conflict: false, dirty: true, files: [], ahead: 0, behind: 0 }
  }
  await fetchRemote(dir, getToken)
  const branch = await currentBranch(dir)
  const result = await resolveAndMerge(dir, branch, author)
  if (!result.conflict) {
    await pushBranch(dir, getToken)
  }
  return result
}
