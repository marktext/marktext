# GitHub Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users browse their GitHub repos inside MarkText, clone one on demand, edit its markdown with the normal editor, and commit/push/pull through a Source Control sidebar panel.

**Architecture:** All git/auth/network/keychain work runs in the Electron **main process** under a new `src/main/github/` module (one file per responsibility: `git.ts`, `auth.ts`, `api.ts`, `ipc.ts`). The sandboxed renderer drives everything through the existing typed IPC bridge and never sees the token. A new Pinia store and a Source Control sidebar panel reuse MarkText's existing open-folder / file-tree machinery for the cloned repo.

**Tech Stack:** Electron 42, isomorphic-git (pure-JS git), Node 20 global `fetch` (no Octokit), keytar (already a dep), Vue 3 + Pinia 3 + Element Plus, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-06-08-github-integration-design.md`

---

## File Structure

**Main process (new) — `packages/desktop/src/main/github/`**

| File | Responsibility |
|---|---|
| `git.ts` | isomorphic-git wrapper: `cloneRepo`, `listChanges`, `stage`/`unstage`, `commit`, `sync` (dirty-guard → fetch → ff / clean-merge / conflict), `detectRepo` (github.com origin match + SSH→HTTPS rewrite, repo root only), `hasLfsPatterns`, `withRepoQueue` (per-repo serialization — isomorphic-git has no `index.lock`). Electron-free so it unit-tests easily. |
| `auth.ts` | OAuth Device Flow + keytar token storage, behind a `GitHubAuthProvider` interface. A new poll cancels any in-flight one; the (non-secret) user identity persists in a second keytar entry so offline commits work. |
| `api.ts` | Minimal GitHub REST client over global `fetch`: `getUser` (login, name, id — source of the commit author via `commitAuthorFor`), `listRepos` (paginated). |
| `ipc.ts` | `registerGitHubHandlers()` — wires `mt::github::*` channels to the three modules above and emits progress/auth events. |
| `config.ts` | The OAuth `client_id` (env-overridable) and constants (service name, scopes, endpoints). |

**Main process (modified)**
- `packages/desktop/src/main/ipc/index.ts` — call `registerGitHubHandlers()`.

**Shared / preload (modified)**
- `packages/desktop/src/shared/types/ipc.ts` — add `mt::github::*` channels + `GitHubRepoInfo`/`GitHubChangeInfo`/`GitHubSyncResult`/`GitHubDeviceCode`/`GitHubAuthStatus`/`GitHubRepoDetection` types.
- `packages/desktop/src/preload/index.ts` — expose `githubAPI` on `window.github`.
- `packages/desktop/src/types/global.d.ts` — declare `window.github`.

**Renderer (new)**
- `packages/desktop/src/renderer/src/store/github.ts` — Pinia store.
- `packages/desktop/src/renderer/src/components/sideBar/sourceControl.vue` — the panel.
- `packages/desktop/src/renderer/src/components/github/repoBrowser.vue` — sign-in + repo list + clone modal.

**Renderer (modified)**
- `packages/desktop/src/renderer/src/components/sideBar/help.ts` — add the Source Control activity-bar icon.
- `packages/desktop/src/renderer/src/components/sideBar/index.vue` — render the panel when `rightColumn === 'source-control'`.

**Tests (new) — `packages/desktop/test/unit/specs/`**
- `github-git.spec.ts`, `github-auth.spec.ts`, `github-api.spec.ts`.

---

## Phase 1 — Main-process core (no UI)

### Task 1: Add dependency and module scaffold

**Files:**
- Modify: `packages/desktop/package.json`
- Create: `packages/desktop/src/main/github/config.ts`

- [ ] **Step 1: Add isomorphic-git**

Run from repo root:

```bash
pnpm --filter marktext add isomorphic-git
```

Expected: `isomorphic-git` appears under `dependencies` in `packages/desktop/package.json` and `pnpm-lock.yaml` updates. (keytar is already present; `isomorphic-git/http/node` ships inside the same package — no separate install.)

- [ ] **Step 2: Create the config module**

Create `packages/desktop/src/main/github/config.ts`:

```ts
// OAuth Device Flow + git constants for the GitHub integration.
// The client_id is public (device flow needs no secret); ship it in source.
// Override with MARKTEXT_GITHUB_CLIENT_ID for local development against a
// throwaway OAuth App.
export const GITHUB_CLIENT_ID = process.env.MARKTEXT_GITHUB_CLIENT_ID || ''

export const GITHUB_OAUTH_SCOPE = 'repo'

// keytar storage coordinates for the access token and the (non-secret)
// user identity persisted for offline commits / signed-in display.
export const KEYTAR_SERVICE = 'marktext-github'
export const KEYTAR_ACCOUNT = 'oauth-token'
export const KEYTAR_ACCOUNT_IDENTITY = 'user-identity'

export const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code'
export const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
export const GITHUB_API_BASE = 'https://api.github.com'
export const GITHUB_VERIFICATION_URI = 'https://github.com/login/device'
```

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/package.json pnpm-lock.yaml packages/desktop/src/main/github/config.ts
git commit -m "feat(github): add isomorphic-git dep and github config module"
```

---

### Task 2: `git.ts` — local operations (status / stage / commit)

These operations work on a local repo with no network, so we test them against a real temp repo created with isomorphic-git.

**Files:**
- Create: `packages/desktop/src/main/github/git.ts`
- Test: `packages/desktop/test/unit/specs/github-git.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/desktop/test/unit/specs/github-git.spec.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs'
import git from 'isomorphic-git'
import { listChanges, stage, commit, detectRepo, hasLfsPatterns } from 'main_renderer/github/git'

let dir: string

const initRepo = async (): Promise<void> => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-git-'))
  await git.init({ fs, dir, defaultBranch: 'main' })
  fs.writeFileSync(path.join(dir, 'a.md'), '# hello\n')
  await git.add({ fs, dir, filepath: 'a.md' })
  await git.commit({
    fs,
    dir,
    message: 'init',
    author: { name: 'Test', email: 'test@example.com' }
  })
}

describe('github/git local ops', () => {
  beforeEach(initRepo)
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('listChanges reports modified and untracked files', async () => {
    fs.writeFileSync(path.join(dir, 'a.md'), '# hello world\n')
    fs.writeFileSync(path.join(dir, 'b.md'), '# new\n')
    const changes = await listChanges(dir)
    const byPath = Object.fromEntries(changes.map((c) => [c.filepath, c]))
    expect(byPath['a.md'].status).toBe('modified')
    expect(byPath['a.md'].staged).toBe(false)
    expect(byPath['b.md'].status).toBe('untracked')
  })

  it('stage then commit clears the change list', async () => {
    fs.writeFileSync(path.join(dir, 'b.md'), '# new\n')
    await stage(dir, ['b.md'])
    const staged = (await listChanges(dir)).find((c) => c.filepath === 'b.md')
    expect(staged?.staged).toBe(true)
    await commit(dir, 'add b', { name: 'Test', email: 'test@example.com' })
    expect(await listChanges(dir)).toHaveLength(0)
  })

  it('detectRepo identifies a github origin and rewrites SSH to HTTPS', async () => {
    await git.addRemote({ fs, dir, remote: 'origin', url: 'git@github.com:octocat/hello.git' })
    expect(await detectRepo(dir)).toEqual({
      isRepo: true,
      remoteUrl: 'git@github.com:octocat/hello.git',
      httpsUrl: 'https://github.com/octocat/hello.git'
    })
    expect(await detectRepo(os.tmpdir())).toEqual({ isRepo: false })
  })

  it('hasLfsPatterns detects filter=lfs in .gitattributes', async () => {
    expect(await hasLfsPatterns(dir)).toBe(false)
    fs.writeFileSync(
      path.join(dir, '.gitattributes'),
      '*.png filter=lfs diff=lfs merge=lfs -text\n'
    )
    expect(await hasLfsPatterns(dir)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/desktop exec vitest run test/unit/specs/github-git.spec.ts`
Expected: FAIL — `Failed to resolve import "main_renderer/github/git"` / functions not defined.

- [ ] **Step 3: Implement the local operations**

Create `packages/desktop/src/main/github/git.ts`:

```ts
import fs from 'fs'
import git from 'isomorphic-git'

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
export const listChanges = async (dir: string): Promise<GitChange[]> => {
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
    // Staged when the index differs from HEAD (stageEntry >= 2 and != HEAD).
    const staged = stageEntry >= 2 || (head === 1 && stageEntry === 0)
    changes.push({ filepath, status, staged })
  }
  return changes
}

export const stage = async (dir: string, files: string[]): Promise<void> => {
  for (const filepath of files) {
    if (fs.existsSync(`${dir}/${filepath}`)) {
      await git.add({ fs, dir, filepath })
    } else {
      await git.remove({ fs, dir, filepath })
    }
  }
}

export const unstage = async (dir: string, files: string[]): Promise<void> => {
  for (const filepath of files) {
    await git.resetIndex({ fs, dir, filepath })
  }
}

export const commit = async (dir: string, message: string, author: GitAuthor): Promise<string> => {
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
export const detectRepo = async (dir: string): Promise<RepoDetection> => {
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
export const hasLfsPatterns = async (dir: string): Promise<boolean> => {
  try {
    const attrs = await fs.promises.readFile(`${dir}/.gitattributes`, 'utf8')
    return /(^|\s)filter=lfs(\s|$)/m.test(attrs)
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C packages/desktop exec vitest run test/unit/specs/github-git.spec.ts`
Expected: PASS (4 passing).

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/main/github/git.ts packages/desktop/test/unit/specs/github-git.spec.ts
git commit -m "feat(github): add local git ops plus repo/LFS detection"
```

---

### Task 3: `git.ts` — sync (merge / conflict detection)

The safety-critical piece. `sync` first refuses a dirty working tree (**before any network I/O** — a merge/checkout over uncommitted changes could clobber them, and v1 has no stash), then fetches and merges `origin/<branch>` with `abortOnConflict: true` so a conflicting merge leaves the working tree untouched and we report it instead of corrupting state. We can test the dirty guard and the merge/conflict branch entirely locally by hand-building a diverged `refs/remotes/origin/main`.

**Files:**
- Modify: `packages/desktop/src/main/github/git.ts`
- Test: `packages/desktop/test/unit/specs/github-git.spec.ts`

- [ ] **Step 1: Write the failing test (append to the existing spec)**

Add to `packages/desktop/test/unit/specs/github-git.spec.ts`:

```ts
import { resolveAndMerge, sync, withRepoQueue } from 'main_renderer/github/git'

describe('github/git resolveAndMerge', () => {
  beforeEach(initRepo)
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('fast-forwards when local is strictly behind', async () => {
    // origin advances a.md; local stays at init.
    const oid = await git.commit({
      fs,
      dir,
      message: 'remote change',
      author: { name: 'R', email: 'r@example.com' },
      // commit on a detached ref to simulate the remote tip
      ref: 'refs/remotes/origin/main'
    })
    // local HEAD is the parent of oid → fast-forwardable.
    const res = await resolveAndMerge(dir, 'main', { name: 'M', email: 'm@example.com' })
    expect(res.conflict).toBe(false)
    const head = await git.resolveRef({ fs, dir, ref: 'HEAD' })
    expect(head).toBe(oid)
  })

  it('reports conflict without mutating the working tree', async () => {
    // Diverge: local edits a.md one way...
    fs.writeFileSync(path.join(dir, 'a.md'), '# local edit\n')
    await git.add({ fs, dir, filepath: 'a.md' })
    await git.commit({
      fs,
      dir,
      message: 'local',
      author: { name: 'L', email: 'l@example.com' }
    })
    // ...origin edits the same line differently, branching from init.
    const initOid = await git.resolveRef({ fs, dir, ref: 'HEAD~1' })
    await git.writeRef({ fs, dir, ref: 'refs/heads/tmp', value: initOid, force: true })
    await git.checkout({ fs, dir, ref: 'tmp', force: true })
    fs.writeFileSync(path.join(dir, 'a.md'), '# remote edit\n')
    await git.add({ fs, dir, filepath: 'a.md' })
    const remoteOid = await git.commit({
      fs,
      dir,
      message: 'remote',
      author: { name: 'R', email: 'r@example.com' }
    })
    await git.writeRef({ fs, dir, ref: 'refs/remotes/origin/main', value: remoteOid, force: true })
    await git.checkout({ fs, dir, ref: 'main', force: true })

    const before = fs.readFileSync(path.join(dir, 'a.md'), 'utf8')
    const res = await resolveAndMerge(dir, 'main', { name: 'M', email: 'm@example.com' })
    expect(res.conflict).toBe(true)
    expect(res.files).toContain('a.md')
    // Working tree unchanged — no conflict markers written.
    expect(fs.readFileSync(path.join(dir, 'a.md'), 'utf8')).toBe(before)
  })

  it('sync refuses a dirty working tree before touching the network', async () => {
    fs.writeFileSync(path.join(dir, 'a.md'), '# uncommitted local edit\n')
    // No fetch mock needed: the dirty guard must return before any network I/O.
    const res = await sync(dir, async () => 'tok', { name: 'M', email: 'm@example.com' })
    expect(res.dirty).toBe(true)
    expect(fs.readFileSync(path.join(dir, 'a.md'), 'utf8')).toBe('# uncommitted local edit\n')
  })
})

describe('github/git withRepoQueue', () => {
  it('serializes operations on the same repo path', async () => {
    const order: number[] = []
    const slow = withRepoQueue('/repo', async () => {
      await new Promise((r) => setTimeout(r, 20))
      order.push(1)
    })
    const fast = withRepoQueue('/repo', async () => {
      order.push(2)
    })
    await Promise.all([slow, fast])
    expect(order).toEqual([1, 2])
  })

  it('keeps the queue alive after a failed operation', async () => {
    await expect(
      withRepoQueue('/repo', async () => {
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')
    expect(await withRepoQueue('/repo', async () => 'ok')).toBe('ok')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/desktop exec vitest run test/unit/specs/github-git.spec.ts -t resolveAndMerge`
Expected: FAIL — `resolveAndMerge` is not exported.

- [ ] **Step 3: Implement `resolveAndMerge` plus the network wrappers**

Add to `packages/desktop/src/main/github/git.ts`:

```ts
import http from 'isomorphic-git/http/node'

export interface SyncResult {
  conflict: boolean
  dirty: boolean
  files: string[]
  ahead: number
  behind: number
}

export type TokenProvider = () => Promise<string | null>

const onAuth = (getToken: TokenProvider) => async () => {
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

export const cloneRepo = async (
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

export const currentBranch = async (dir: string): Promise<string> => {
  return (await git.currentBranch({ fs, dir, fullname: false })) || 'main'
}

const countCommits = async (dir: string, ref: string, notRef: string): Promise<number> => {
  try {
    const base = await git.findMergeBase({ fs, dir, oids: [
      await git.resolveRef({ fs, dir, ref }),
      await git.resolveRef({ fs, dir, ref: notRef })
    ] })
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
export const resolveAndMerge = async (
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

export const fetchRemote = async (dir: string, getToken: TokenProvider): Promise<void> => {
  await git.fetch({ fs, http, dir, singleBranch: true, onAuth: onAuth(getToken) })
}

export const pushBranch = async (dir: string, getToken: TokenProvider): Promise<void> => {
  await git.push({ fs, http, dir, onAuth: onAuth(getToken) })
}

// Full sync: dirty-guard → fetch → merge (ff / clean / conflict) → push when
// clean. The dirty guard runs before any network I/O: the renderer save-alls
// first, but main is the authoritative check (spec: Sync preconditions).
export const sync = async (
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C packages/desktop exec vitest run test/unit/specs/github-git.spec.ts`
Expected: PASS (all `local ops` + `resolveAndMerge` tests green).

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/main/github/git.ts packages/desktop/test/unit/specs/github-git.spec.ts
git commit -m "feat(github): add fetch/merge/push sync with safe conflict reporting"
```

---

### Task 4: `auth.ts` — OAuth Device Flow + keytar

> keytar is archived upstream; we keep it for v1 because it already ships with
> MarkText. The `GitHubAuthProvider` interface below is the seam for migrating
> to Electron's `safeStorage` later.

**Files:**
- Create: `packages/desktop/src/main/github/auth.ts`
- Test: `packages/desktop/test/unit/specs/github-auth.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/desktop/test/unit/specs/github-auth.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const store: Record<string, string | null> = {}
vi.mock('keytar', () => ({
  default: {
    getPassword: vi.fn(async (_s: string, a: string) => store[a] ?? null),
    setPassword: vi.fn(async (_s: string, a: string, v: string) => {
      store[a] = v
    }),
    deletePassword: vi.fn(async (_s: string, a: string) => {
      delete store[a]
      return true
    })
  }
}))

import {
  requestDeviceCode,
  pollForToken,
  getToken,
  signOut,
  saveIdentity,
  loadIdentity
} from 'main_renderer/github/auth'

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k]
  vi.restoreAllMocks()
})
afterEach(() => vi.useRealTimers())

describe('github/auth', () => {
  it('requestDeviceCode returns the user-facing code info', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        device_code: 'dc',
        user_code: 'WDJB-MJHT',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 5
      })
    })) as unknown as typeof fetch)

    const info = await requestDeviceCode()
    expect(info.userCode).toBe('WDJB-MJHT')
    expect(info.deviceCode).toBe('dc')
    expect(info.interval).toBe(5)
  })

  it('pollForToken stores the token once authorization completes', async () => {
    vi.useFakeTimers()
    let calls = 0
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => {
        calls++
        return calls < 2
          ? { error: 'authorization_pending' }
          : { access_token: 'gho_abc' }
      }
    })) as unknown as typeof fetch)

    const promise = pollForToken('dc', 1)
    await vi.advanceTimersByTimeAsync(1000) // first poll: pending
    await vi.advanceTimersByTimeAsync(1000) // second poll: success
    const token = await promise
    expect(token).toBe('gho_abc')
    expect(await getToken()).toBe('gho_abc')
  })

  it('starting a new poll cancels the in-flight one', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ error: 'authorization_pending' })
    })) as unknown as typeof fetch)
    const first = pollForToken('dc-old', 1)
    const firstRejects = expect(first).rejects.toThrow('cancelled')
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ access_token: 'gho_new' })
    })) as unknown as typeof fetch)
    const second = pollForToken('dc-new', 1)
    await vi.advanceTimersByTimeAsync(1000)
    await firstRejects
    expect(await second).toBe('gho_new')
  })

  it('persists and reloads the user identity', async () => {
    await saveIdentity({ login: 'octocat', name: 'The Octocat', id: 583231 })
    expect(await loadIdentity()).toEqual({ login: 'octocat', name: 'The Octocat', id: 583231 })
  })

  it('signOut clears the stored token and identity', async () => {
    store['oauth-token'] = 'gho_abc'
    store['user-identity'] = '{"login":"octocat","name":null,"id":583231}'
    await signOut()
    expect(await getToken()).toBeNull()
    expect(await loadIdentity()).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/desktop exec vitest run test/unit/specs/github-auth.spec.ts`
Expected: FAIL — module / exports not found.

- [ ] **Step 3: Implement `auth.ts`**

Create `packages/desktop/src/main/github/auth.ts`:

```ts
import keytar from 'keytar'
import {
  GITHUB_CLIENT_ID,
  GITHUB_OAUTH_SCOPE,
  GITHUB_DEVICE_CODE_URL,
  GITHUB_TOKEN_URL,
  KEYTAR_SERVICE,
  KEYTAR_ACCOUNT,
  KEYTAR_ACCOUNT_IDENTITY
} from './config'

export interface DeviceCodeInfo {
  deviceCode: string
  userCode: string
  verificationUri: string
  expiresIn: number
  interval: number
}

// Provider interface so a PAT provider can be dropped in later (spec: out of
// scope for v1, but the seam exists).
export interface GitHubAuthProvider {
  signIn(): Promise<DeviceCodeInfo>
  getToken(): Promise<string | null>
  signOut(): Promise<void>
}

export const getToken = (): Promise<string | null> =>
  keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)

// The identity is persisted (it is not a secret) so commit — a purely local
// operation — and the signed-in display work offline and across restarts
// without a network round-trip (spec: Commit identity).
export interface StoredIdentity {
  login: string
  name: string | null
  id: number
}

export const saveIdentity = (identity: StoredIdentity): Promise<void> =>
  keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_IDENTITY, JSON.stringify(identity))

export const loadIdentity = async (): Promise<StoredIdentity | null> => {
  const raw = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_IDENTITY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredIdentity
  } catch {
    return null
  }
}

export const signOut = async (): Promise<void> => {
  // Local sign-out only: device-flow apps cannot revoke the token
  // server-side (that requires the client secret). Documented in the spec.
  await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)
  await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_IDENTITY)
}

export const requestDeviceCode = async (): Promise<DeviceCodeInfo> => {
  const res = await fetch(GITHUB_DEVICE_CODE_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, scope: GITHUB_OAUTH_SCOPE })
  })
  if (!res.ok) throw new Error(`GitHub device code request failed: ${res.status}`)
  const data = await res.json()
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresIn: data.expires_in,
    interval: data.interval
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

// Polls the token endpoint until the user authorizes (or the code expires).
// intervalSeconds comes from requestDeviceCode(); GitHub may ask us to back
// off. Starting a new poll cancels any in-flight one — clicking "Sign in"
// twice must not leave two pollers racing to write the token.
let pollGeneration = 0

export const pollForToken = async (deviceCode: string, intervalSeconds: number): Promise<string> => {
  const generation = ++pollGeneration
  let interval = intervalSeconds
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await sleep(interval * 1000)
    if (generation !== pollGeneration) throw new Error('Polling cancelled by a newer sign-in')
    const res = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      })
    })
    const data = await res.json()
    if (data.access_token) {
      await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, data.access_token)
      return data.access_token
    }
    if (data.error === 'authorization_pending') continue
    if (data.error === 'slow_down') {
      interval = (data.interval ?? interval) + 5
      continue
    }
    throw new Error(`GitHub authorization failed: ${data.error ?? 'unknown'}`)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C packages/desktop exec vitest run test/unit/specs/github-auth.spec.ts`
Expected: PASS (5 passing).

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/main/github/auth.ts packages/desktop/test/unit/specs/github-auth.spec.ts
git commit -m "feat(github): add OAuth device-flow auth with keytar storage"
```

---

### Task 5: `api.ts` — GitHub REST client

**Files:**
- Create: `packages/desktop/src/main/github/api.ts`
- Test: `packages/desktop/test/unit/specs/github-api.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/desktop/test/unit/specs/github-api.spec.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { getUser, listRepos, commitAuthorFor } from 'main_renderer/github/api'

afterEach(() => vi.restoreAllMocks())

describe('github/api', () => {
  it('getUser returns the fields the commit author is built from', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ login: 'octocat', name: 'The Octocat', id: 583231 })
    })) as unknown as typeof fetch)
    expect(await getUser('tok')).toEqual({ login: 'octocat', name: 'The Octocat', id: 583231 })
  })

  it('commitAuthorFor builds the noreply identity', () => {
    expect(commitAuthorFor({ login: 'octocat', name: 'The Octocat', id: 583231 })).toEqual({
      name: 'The Octocat',
      email: '583231+octocat@users.noreply.github.com'
    })
    // Profiles without a display name fall back to the login.
    expect(commitAuthorFor({ login: 'octocat', name: null, id: 583231 }).name).toBe('octocat')
  })

  it('listRepos maps the fields we care about', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => [
        { full_name: 'octocat/hello', clone_url: 'https://github.com/octocat/hello.git', private: false, default_branch: 'main' }
      ]
    })) as unknown as typeof fetch)
    const repos = await listRepos('tok')
    expect(repos[0]).toEqual({
      fullName: 'octocat/hello',
      cloneUrl: 'https://github.com/octocat/hello.git',
      private: false,
      defaultBranch: 'main'
    })
  })

  it('listRepos follows pagination until a short page', async () => {
    const raw = (i: number) => ({
      full_name: `octocat/repo-${i}`,
      clone_url: `https://github.com/octocat/repo-${i}.git`,
      private: false,
      default_branch: 'main'
    })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => Array.from({ length: 100 }, (_, i) => raw(i)) })
      .mockResolvedValueOnce({ ok: true, json: async () => [raw(100)] })
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
    const repos = await listRepos('tok')
    expect(repos).toHaveLength(101)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1][0])).toContain('page=2')
  })

  it('throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401 })) as unknown as typeof fetch)
    await expect(getUser('bad')).rejects.toThrow('401')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/desktop exec vitest run test/unit/specs/github-api.spec.ts`
Expected: FAIL — module / exports not found.

- [ ] **Step 3: Implement `api.ts`**

Create `packages/desktop/src/main/github/api.ts`:

```ts
import { GITHUB_API_BASE } from './config'

export interface GitHubUser {
  login: string
  name: string | null
  id: number
}

export interface GitHubRepo {
  fullName: string
  cloneUrl: string
  private: boolean
  defaultBranch: string
}

const request = async <T>(path: string, token: string): Promise<T> => {
  const res = await fetch(`${GITHUB_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  })
  if (!res.ok) throw new Error(`GitHub API ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}

export const getUser = async (token: string): Promise<GitHubUser> => {
  const data = await request<{ login: string; name: string | null; id: number }>('/user', token)
  return { login: data.login, name: data.name, id: data.id }
}

// Commits are authored with GitHub's noreply address so they attribute
// correctly on github.com without leaking a private email (spec: Commit
// identity).
export const commitAuthorFor = (user: GitHubUser): { name: string; email: string } => ({
  name: user.name || user.login,
  email: `${user.id}+${user.login}@users.noreply.github.com`
})

interface RawRepo {
  full_name: string
  clone_url: string
  private: boolean
  default_branch: string
}

// Paginated: users routinely exceed one page of repos.
export const listRepos = async (token: string): Promise<GitHubRepo[]> => {
  const repos: GitHubRepo[] = []
  for (let page = 1; ; page++) {
    const data = await request<RawRepo[]>(
      `/user/repos?per_page=100&sort=updated&page=${page}`,
      token
    )
    repos.push(
      ...data.map((r) => ({
        fullName: r.full_name,
        cloneUrl: r.clone_url,
        private: r.private,
        defaultBranch: r.default_branch
      }))
    )
    if (data.length < 100) break
  }
  return repos
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C packages/desktop exec vitest run test/unit/specs/github-api.spec.ts`
Expected: PASS (5 passing).

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/main/github/api.ts packages/desktop/test/unit/specs/github-api.spec.ts
git commit -m "feat(github): add minimal GitHub REST client over fetch"
```

---

## Phase 2 — IPC wiring

### Task 6: Add IPC channel types

**Files:**
- Modify: `packages/desktop/src/shared/types/ipc.ts`

- [ ] **Step 1: Add shared payload types**

At the bottom of `packages/desktop/src/shared/types/ipc.ts`, before the "Helper types" section, add:

```ts
// =================================================================
// GitHub integration payloads
// =================================================================

export interface GitHubRepoInfo {
  fullName: string
  cloneUrl: string
  private: boolean
  defaultBranch: string
}

export interface GitHubChangeInfo {
  filepath: string
  status: 'modified' | 'untracked' | 'deleted' | 'added'
  staged: boolean
}

export interface GitHubSyncResult {
  conflict: boolean
  dirty: boolean
  files: string[]
  ahead: number
  behind: number
}

export interface GitHubRepoDetection {
  isRepo: boolean
  remoteUrl?: string
  httpsUrl?: string
}

export interface GitHubDeviceCode {
  userCode: string
  verificationUri: string
  expiresIn: number
  interval: number
}

export interface GitHubAuthStatus {
  signedIn: boolean
  username?: string
}
```

- [ ] **Step 2: Register the invoke channels**

Inside `interface IpcInvokeChannels`, add (keep alphabetical grouping with the other `mt::` entries):

```ts
  'mt::github::auth-start': { args: []; ret: GitHubDeviceCode }
  'mt::github::auth-status': { args: []; ret: GitHubAuthStatus }
  'mt::github::sign-out': { args: []; ret: void }
  'mt::github::list-repos': { args: []; ret: GitHubRepoInfo[] }
  'mt::github::clone': { args: [cloneUrl: string, targetDir: string]; ret: { localPath: string } }
  'mt::github::status': { args: [repoPath: string]; ret: GitHubChangeInfo[] }
  'mt::github::stage': { args: [repoPath: string, files: string[]]; ret: GitHubChangeInfo[] }
  'mt::github::unstage': { args: [repoPath: string, files: string[]]; ret: GitHubChangeInfo[] }
  'mt::github::commit': { args: [repoPath: string, message: string]; ret: { oid: string } }
  'mt::github::sync': { args: [repoPath: string]; ret: GitHubSyncResult }
  'mt::github::repo-info': { args: [path: string]; ret: GitHubRepoDetection }
  'mt::github::lfs-check': { args: [repoPath: string]; ret: boolean }
```

- [ ] **Step 3: Register the push-event channels**

Inside `interface IpcMainEventChannels`, add:

```ts
  'mt::github::auth-success': [status: GitHubAuthStatus]
  'mt::github::auth-error': [message: string]
  'mt::github::clone-progress': [progress: { phase: string; loaded: number; total: number }]
  'mt::github::status-changed': [repoPath: string]
```

- [ ] **Step 4: Typecheck**

Run: `pnpm run typecheck`
Expected: PASS (no new errors from `ipc.ts`).

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/shared/types/ipc.ts
git commit -m "feat(github): add mt::github::* IPC channel contract"
```

---

### Task 7: `ipc.ts` handlers and registration

**Files:**
- Create: `packages/desktop/src/main/github/ipc.ts`
- Modify: `packages/desktop/src/main/ipc/index.ts`

- [ ] **Step 1: Implement the handlers**

Create `packages/desktop/src/main/github/ipc.ts`:

```ts
import { ipcMain, BrowserWindow } from 'electron'
import log from 'electron-log'
import path from 'path'
import * as gitOps from './git'
import * as auth from './auth'
import * as api from './api'

// Commit identity comes from the GitHub profile (noreply email) — MarkText
// has no git identity of its own (spec: Commit identity). The persisted
// identity keeps commit working offline; the network fetch is only a
// fallback for tokens stored before identity persistence existed.
let cachedAuthor: gitOps.GitAuthor | null = null
const author = async (): Promise<gitOps.GitAuthor> => {
  if (cachedAuthor) return cachedAuthor
  const identity = await auth.loadIdentity()
  if (identity) {
    cachedAuthor = api.commitAuthorFor(identity)
    return cachedAuthor
  }
  const token = await auth.getToken()
  if (!token) throw new Error('Not authenticated with GitHub')
  const user = await api.getUser(token)
  await auth.saveIdentity(user)
  cachedAuthor = api.commitAuthorFor(user)
  return cachedAuthor
}

const senderWindow = (e: Electron.IpcMainInvokeEvent): BrowserWindow | null =>
  BrowserWindow.fromWebContents(e.sender)

// status-changed is broadcast: two windows can have the same repo open and
// each window's store filters by its own repoPath. Auth + clone-progress
// events target only the initiating window.
const broadcastStatusChanged = (repoPath: string): void => {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('mt::github::status-changed', repoPath)
  }
}

export const registerGitHubHandlers = (): void => {
  ipcMain.handle('mt::github::auth-status', async (): Promise<{ signedIn: boolean; username?: string }> => {
    // Offline-friendly (spec: IPC contract): token presence = signed in, no
    // network round-trip. Token validity surfaces lazily when a network op
    // fails with 401.
    const token = await auth.getToken()
    if (!token) return { signedIn: false }
    const identity = await auth.loadIdentity()
    return { signedIn: true, username: identity?.login }
  })

  ipcMain.handle('mt::github::auth-start', async (e) => {
    const info = await auth.requestDeviceCode()
    const win = senderWindow(e)
    // Poll in the background; notify the renderer when it resolves.
    auth
      .pollForToken(info.deviceCode, info.interval)
      .then(async (token) => {
        const user = await api.getUser(token)
        await auth.saveIdentity(user)
        cachedAuthor = api.commitAuthorFor(user)
        win?.webContents.send('mt::github::auth-success', { signedIn: true, username: user.login })
      })
      .catch((err) => {
        log.error('GitHub auth failed:', err)
        win?.webContents.send('mt::github::auth-error', String(err?.message ?? err))
      })
    return {
      userCode: info.userCode,
      verificationUri: info.verificationUri,
      expiresIn: info.expiresIn,
      interval: info.interval
    }
  })

  ipcMain.handle('mt::github::sign-out', () => {
    cachedAuthor = null
    return auth.signOut()
  })

  ipcMain.handle('mt::github::repo-info', (_e, path: string) => gitOps.detectRepo(path))

  ipcMain.handle('mt::github::lfs-check', (_e, repoPath: string) => gitOps.hasLfsPatterns(repoPath))

  ipcMain.handle('mt::github::list-repos', async () => {
    const token = await auth.getToken()
    if (!token) throw new Error('Not authenticated with GitHub')
    return api.listRepos(token)
  })

  ipcMain.handle('mt::github::clone', async (e, cloneUrl: string, targetDir: string) => {
    const repoName = path.basename(cloneUrl).replace(/\.git$/, '')
    const localPath = path.join(targetDir, repoName)
    const win = senderWindow(e)
    // isomorphic-git fires onProgress extremely often — throttle the IPC
    // forwarding (spec: IPC contract).
    let lastProgress = 0
    await gitOps.cloneRepo(cloneUrl, localPath, auth.getToken, (p) => {
      const now = Date.now()
      if (now - lastProgress < 100 && p.loaded !== p.total) return
      lastProgress = now
      win?.webContents.send('mt::github::clone-progress', p)
    })
    return { localPath }
  })

  // Every git operation goes through the per-repo queue (spec: Concurrency):
  // isomorphic-git has no index.lock, so two windows — or a watcher-driven
  // status racing a commit — could otherwise corrupt the index.
  ipcMain.handle('mt::github::status', (_e, repoPath: string) =>
    gitOps.withRepoQueue(repoPath, () => gitOps.listChanges(repoPath))
  )

  ipcMain.handle('mt::github::stage', (_e, repoPath: string, files: string[]) =>
    gitOps.withRepoQueue(repoPath, async () => {
      await gitOps.stage(repoPath, files)
      broadcastStatusChanged(repoPath)
      return gitOps.listChanges(repoPath)
    })
  )

  ipcMain.handle('mt::github::unstage', (_e, repoPath: string, files: string[]) =>
    gitOps.withRepoQueue(repoPath, async () => {
      await gitOps.unstage(repoPath, files)
      broadcastStatusChanged(repoPath)
      return gitOps.listChanges(repoPath)
    })
  )

  ipcMain.handle('mt::github::commit', (_e, repoPath: string, message: string) =>
    gitOps.withRepoQueue(repoPath, async () => {
      const oid = await gitOps.commit(repoPath, message, await author())
      broadcastStatusChanged(repoPath)
      return { oid }
    })
  )

  ipcMain.handle('mt::github::sync', (_e, repoPath: string) =>
    gitOps.withRepoQueue(repoPath, async () => {
      const result = await gitOps.sync(repoPath, auth.getToken, await author())
      broadcastStatusChanged(repoPath)
      return result
    })
  )
}
```

- [ ] **Step 2: Register in the IPC bootstrap**

In `packages/desktop/src/main/ipc/index.ts`, add the import and the call:

```ts
import { registerGitHubHandlers } from '../github/ipc'
```

and inside `registerSandboxIpcHandlers`, after `registerI18nHandlers()`:

```ts
  registerGitHubHandlers()
```

- [ ] **Step 3: Typecheck and build the main process**

Run: `pnpm run typecheck && pnpm run build:unpack`
Expected: PASS — main process compiles with the new handlers.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src/main/github/ipc.ts packages/desktop/src/main/ipc/index.ts
git commit -m "feat(github): wire mt::github::* IPC handlers into main"
```

---

### Task 8: Preload bridge + global types

**Files:**
- Modify: `packages/desktop/src/preload/index.ts`
- Modify: `packages/desktop/src/types/global.d.ts`

- [ ] **Step 1: Add the preload API object**

In `packages/desktop/src/preload/index.ts`, after the `fontsAPI` definition (~line 227), add:

```ts
const githubAPI = {
  authStatus: () => invoke('mt::github::auth-status'),
  authStart: () => invoke('mt::github::auth-start'),
  signOut: () => invoke('mt::github::sign-out'),
  listRepos: () => invoke('mt::github::list-repos'),
  clone: (cloneUrl: string, targetDir: string) => invoke('mt::github::clone', cloneUrl, targetDir),
  status: (repoPath: string) => invoke('mt::github::status', repoPath),
  stage: (repoPath: string, files: string[]) => invoke('mt::github::stage', repoPath, files),
  unstage: (repoPath: string, files: string[]) => invoke('mt::github::unstage', repoPath, files),
  commit: (repoPath: string, message: string) => invoke('mt::github::commit', repoPath, message),
  sync: (repoPath: string) => invoke('mt::github::sync', repoPath),
  repoInfo: (path: string) => invoke('mt::github::repo-info', path),
  lfsCheck: (repoPath: string) => invoke('mt::github::lfs-check', repoPath),
  onAuthSuccess: (handler: (status: { signedIn: boolean; username?: string }) => void) =>
    ipcWrapper.on('mt::github::auth-success', (_e, status) => handler(status)),
  onAuthError: (handler: (message: string) => void) =>
    ipcWrapper.on('mt::github::auth-error', (_e, message) => handler(message)),
  onCloneProgress: (handler: (p: { phase: string; loaded: number; total: number }) => void) =>
    ipcWrapper.on('mt::github::clone-progress', (_e, p) => handler(p)),
  onStatusChanged: (handler: (repoPath: string) => void) =>
    ipcWrapper.on('mt::github::status-changed', (_e, repoPath) => handler(repoPath))
}
```

- [ ] **Step 2: Expose it on the main world**

In the `try { ... }` block near the bottom, after `contextBridge.exposeInMainWorld('fonts', fontsAPI)`, add:

```ts
  contextBridge.exposeInMainWorld('github', githubAPI)
```

- [ ] **Step 3: Declare the global type**

In `packages/desktop/src/types/global.d.ts`, inside `declare global`, add an interface and a `var` (match the style of the existing `fonts` / `uploader` globals — find how they are declared near the bottom of the file and mirror it):

```ts
  interface GitHubAPI {
    authStatus(): Promise<import('@shared/types/ipc').GitHubAuthStatus>
    authStart(): Promise<import('@shared/types/ipc').GitHubDeviceCode>
    signOut(): Promise<void>
    listRepos(): Promise<import('@shared/types/ipc').GitHubRepoInfo[]>
    clone(cloneUrl: string, targetDir: string): Promise<{ localPath: string }>
    status(repoPath: string): Promise<import('@shared/types/ipc').GitHubChangeInfo[]>
    stage(repoPath: string, files: string[]): Promise<import('@shared/types/ipc').GitHubChangeInfo[]>
    unstage(repoPath: string, files: string[]): Promise<import('@shared/types/ipc').GitHubChangeInfo[]>
    commit(repoPath: string, message: string): Promise<{ oid: string }>
    sync(repoPath: string): Promise<import('@shared/types/ipc').GitHubSyncResult>
    repoInfo(path: string): Promise<import('@shared/types/ipc').GitHubRepoDetection>
    lfsCheck(repoPath: string): Promise<boolean>
    onAuthSuccess(handler: (status: import('@shared/types/ipc').GitHubAuthStatus) => void): () => void
    onAuthError(handler: (message: string) => void): () => void
    onCloneProgress(handler: (p: { phase: string; loaded: number; total: number }) => void): () => void
    onStatusChanged(handler: (repoPath: string) => void): () => void
  }

  // eslint-disable-next-line no-var
  var github: GitHubAPI
```

> Note: if `global.d.ts` declares globals via a single `interface Window { ... }` rather than top-level `var`s, add `github: GitHubAPI` to that `Window` interface instead and reference it as `window.github`. Inspect the file's existing pattern (how `fonts`/`uploader` are declared) and follow it exactly.

- [ ] **Step 4: Typecheck**

Run: `pnpm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/preload/index.ts packages/desktop/src/types/global.d.ts
git commit -m "feat(github): expose typed github bridge to the renderer"
```

---

## Phase 3 — Renderer

### Task 9: Pinia store `store/github.ts`

**Files:**
- Create: `packages/desktop/src/renderer/src/store/github.ts`

- [ ] **Step 1: Implement the store**

Create `packages/desktop/src/renderer/src/store/github.ts`:

```ts
import { ref } from 'vue'
import { defineStore } from 'pinia'
import type {
  GitHubChangeInfo,
  GitHubRepoInfo,
  GitHubSyncResult
} from '@shared/types/ipc'

export const useGithubStore = defineStore('github', () => {
  const signedIn = ref(false)
  const username = ref<string | undefined>(undefined)
  const repoPath = ref<string | null>(null)
  const changes = ref<GitHubChangeInfo[]>([])
  const repos = ref<GitHubRepoInfo[]>([])
  const ahead = ref(0)
  const behind = ref(0)
  const conflictFiles = ref<string[]>([])
  const lfsWarning = ref(false)
  const busy = ref(false)

  const refreshAuth = async (): Promise<void> => {
    const status = await window.github.authStatus()
    signedIn.value = status.signedIn
    username.value = status.username
  }

  const startAuth = async (): Promise<{ userCode: string; verificationUri: string }> => {
    const info = await window.github.authStart()
    window.electron.shell.openExternal(info.verificationUri)
    return info
  }

  const signOut = async (): Promise<void> => {
    await window.github.signOut()
    signedIn.value = false
    username.value = undefined
  }

  const loadRepos = async (): Promise<void> => {
    repos.value = await window.github.listRepos()
  }

  const cloneRepo = async (cloneUrl: string, targetDir: string): Promise<string> => {
    busy.value = true
    try {
      const { localPath } = await window.github.clone(cloneUrl, targetDir)
      return localPath
    } finally {
      busy.value = false
    }
  }

  const setRepo = async (path: string | null): Promise<void> => {
    repoPath.value = path
    // isomorphic-git has no LFS support — warn when the repo uses it.
    lfsWarning.value = path ? await window.github.lfsCheck(path) : false
    await refreshStatus()
  }

  // Called whenever the opened project root changes: the panel serves any
  // git repo with a github.com origin, not only repos cloned through
  // MarkText (spec: UX flow step 3).
  const detectRepoForFolder = async (rootPath: string | null): Promise<void> => {
    if (!rootPath) {
      await setRepo(null)
      return
    }
    const info = await window.github.repoInfo(rootPath)
    await setRepo(info.isRepo ? rootPath : null)
  }

  const refreshStatus = async (): Promise<void> => {
    if (!repoPath.value) {
      changes.value = []
      return
    }
    changes.value = await window.github.status(repoPath.value)
  }

  // statusMatrix walks the whole tree — debounce watcher-driven bursts
  // instead of refreshing once per fs event.
  let statusTimer: ReturnType<typeof setTimeout> | null = null
  const scheduleRefresh = (): void => {
    if (statusTimer) clearTimeout(statusTimer)
    statusTimer = setTimeout(() => {
      statusTimer = null
      void refreshStatus()
    }, 300)
  }

  const stage = async (files: string[]): Promise<void> => {
    if (!repoPath.value) return
    changes.value = await window.github.stage(repoPath.value, files)
  }

  const unstage = async (files: string[]): Promise<void> => {
    if (!repoPath.value) return
    changes.value = await window.github.unstage(repoPath.value, files)
  }

  const commit = async (message: string): Promise<void> => {
    if (!repoPath.value) return
    await window.github.commit(repoPath.value, message)
    await refreshStatus()
  }

  const sync = async (): Promise<GitHubSyncResult | null> => {
    if (!repoPath.value) return null
    busy.value = true
    try {
      // Spec: Sync preconditions. Save all open tabs first — a pull may
      // rewrite files that are open in the editor, and an unsaved buffer
      // would clobber the pulled content on its next save. Main additionally
      // re-verifies a clean tree and returns { dirty: true } otherwise.
      const editorStore = useEditorStore()
      editorStore.ASK_FOR_SAVE_ALL(false)
      const result = await window.github.sync(repoPath.value)
      ahead.value = result.ahead
      behind.value = result.behind
      conflictFiles.value = result.conflict ? result.files : []
      await refreshStatus()
      return result
    } finally {
      busy.value = false
    }
  }

  // Wire push events once at store creation.
  window.github.onAuthSuccess((status) => {
    signedIn.value = status.signedIn
    username.value = status.username
    void loadRepos()
  })
  window.github.onStatusChanged((changed) => {
    if (changed === repoPath.value) scheduleRefresh()
  })

  return {
    signedIn,
    username,
    repoPath,
    changes,
    repos,
    ahead,
    behind,
    conflictFiles,
    lfsWarning,
    busy,
    refreshAuth,
    startAuth,
    signOut,
    loadRepos,
    cloneRepo,
    setRepo,
    detectRepoForFolder,
    refreshStatus,
    scheduleRefresh,
    stage,
    unstage,
    commit,
    sync
  }
})
```

Add the editor-store import at the top of the file alongside the other imports:

```ts
import { useEditorStore } from '@/store/editor'
```

> **Save-all caveat:** `ASK_FOR_SAVE_ALL(false)` (see `store/editor.ts` and its
> use in `sideBar/tree.vue`) is the existing save-all path, but it is
> fire-and-forget (`void`). During implementation, make the sync action wait
> for the saves to land before invoking `mt::github::sync` — e.g. await the
> IPC round-trip if main exposes one, or watch the tabs' saved flags settle.
> The main-process dirty guard is the safety net either way: at worst an
> unsaved tab surfaces as `{ dirty: true }` instead of losing data.

- [ ] **Step 2: Typecheck**

Run: `pnpm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src/renderer/src/store/github.ts
git commit -m "feat(github): add github pinia store"
```

---

### Task 10: Source Control panel + sidebar registration

**Files:**
- Create: `packages/desktop/src/renderer/src/components/sideBar/sourceControl.vue`
- Modify: `packages/desktop/src/renderer/src/components/sideBar/help.ts`
- Modify: `packages/desktop/src/renderer/src/components/sideBar/index.vue`

- [ ] **Step 1: Add the activity-bar icon**

In `packages/desktop/src/renderer/src/components/sideBar/help.ts`, add `Share` to the icon import and a new entry to `sideBarIcons`:

```ts
import {
  Folder as FilesIcon,
  Search as SearchIcon,
  Memo as TocIcon,
  Share as SourceControlIcon,
  Setting as SettingIcon
} from '@element-plus/icons-vue'
```

Add after the `toc` entry in `sideBarIcons`:

```ts
  {
    id: 'source-control',
    name: () => t('sideBar.icons.sourceControl'),
    icon: SourceControlIcon
  }
```

- [ ] **Step 2: Create the panel component**

Create `packages/desktop/src/renderer/src/components/sideBar/sourceControl.vue`:

```vue
<template>
  <div class="source-control">
    <div v-if="!signedIn" class="signed-out">
      <p>Connect MarkText to your GitHub account to clone and sync repositories.</p>
      <el-button type="primary" @click="openRepoBrowser">Sign in to GitHub</el-button>
    </div>

    <template v-else>
      <div class="header">
        <span class="user">@{{ username }}</span>
        <el-button link size="small" @click="openRepoBrowser">Clone repository…</el-button>
      </div>

      <div v-if="!repoPath" class="empty">
        <p>No repository open. Clone one to get started.</p>
      </div>

      <template v-else>
        <el-alert
          v-if="lfsWarning"
          type="warning"
          :closable="false"
          show-icon
          title="This repo uses Git LFS, which MarkText does not support"
          description="LFS-tracked files appear as pointer files; avoid editing them here."
        />

        <el-alert
          v-if="conflictFiles.length"
          type="warning"
          :closable="false"
          show-icon
          title="Sync paused — conflicts need manual resolution"
        >
          <div>{{ conflictFiles.join(', ') }}</div>
          <el-button link size="small" @click="openRepoFolder">Open repo folder</el-button>
        </el-alert>

        <textarea
          v-model="message"
          class="commit-message"
          placeholder="Commit message"
          rows="3"
        />
        <div class="actions">
          <el-button
            type="primary"
            size="small"
            :disabled="!canCommit"
            @click="onCommit"
          >Commit</el-button>
          <!-- Sync requires a clean tree (spec: Sync preconditions); main
               re-verifies, this is just the affordance. -->
          <el-button
            size="small"
            :disabled="changes.length > 0"
            :title="changes.length ? 'Commit your changes first' : ''"
            :loading="busy"
            @click="onSync"
          >Sync<span v-if="ahead || behind"> ({{ ahead }}↑ {{ behind }}↓)</span></el-button>
        </div>

        <ul class="changes">
          <li v-for="c in changes" :key="c.filepath" :class="c.status">
            <el-checkbox
              :model-value="c.staged"
              @change="(v: boolean) => toggleStage(c.filepath, v)"
            />
            <span class="path" :title="c.filepath">{{ c.filepath }}</span>
            <span class="badge">{{ statusLetter(c.status) }}</span>
          </li>
          <li v-if="!changes.length" class="none">No changes</li>
        </ul>
      </template>
    </template>

    <repo-browser v-model="showBrowser" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { useGithubStore } from '@/store/github'
import { useProjectStore } from '@/store/project'
import RepoBrowser from '../github/repoBrowser.vue'

const githubStore = useGithubStore()
const { signedIn, username, repoPath, changes, ahead, behind, conflictFiles, lfsWarning, busy } =
  storeToRefs(githubStore)

const projectStore = useProjectStore()
const { projectTree } = storeToRefs(projectStore)

const message = ref('')
const showBrowser = ref(false)

const canCommit = computed(
  () => message.value.trim().length > 0 && changes.value.some((c) => c.staged)
)

onMounted(() => githubStore.refreshAuth())

// The panel serves any opened folder that is a GitHub repo (spec: UX flow
// step 3) — watch the opened project root and (re)detect.
watch(
  () => projectTree.value?.pathname ?? null,
  (root) => void githubStore.detectRepoForFolder(root),
  { immediate: true }
)

const openRepoBrowser = (): void => {
  showBrowser.value = true
}

const openRepoFolder = (): void => {
  if (repoPath.value) window.electron.shell.showItemInFolder(repoPath.value)
}

const statusLetter = (status: string): string =>
  ({ modified: 'M', untracked: 'U', deleted: 'D', added: 'A' })[status] ?? '?'

const toggleStage = (filepath: string, staged: boolean): void => {
  if (staged) githubStore.stage([filepath])
  else githubStore.unstage([filepath])
}

const onCommit = async (): Promise<void> => {
  await githubStore.commit(message.value.trim())
  message.value = ''
}

const onSync = async (): Promise<void> => {
  const result = await githubStore.sync()
  if (!result) return
  if (result.dirty) {
    ElMessage.warning('Commit your changes first.')
  } else if (result.conflict) {
    ElMessage.warning('Sync paused: resolve conflicts manually.')
  } else {
    ElMessage.success('Synced with GitHub.')
  }
}
</script>

<style scoped>
.source-control {
  height: 100%;
  padding: 8px 10px;
  box-sizing: border-box;
  overflow-y: auto;
  font-size: 13px;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.user {
  font-weight: 600;
}
.commit-message {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  background: var(--floatBgColor);
  color: var(--editorColor);
  border: 1px solid var(--itemBgColor);
  border-radius: 4px;
  padding: 6px;
}
.actions {
  display: flex;
  gap: 6px;
  margin: 8px 0;
}
.changes {
  list-style: none;
  margin: 0;
  padding: 0;
}
.changes li {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
}
.changes .path {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.changes .badge {
  opacity: 0.6;
  font-family: monospace;
}
.changes .none,
.empty,
.signed-out {
  opacity: 0.7;
  padding: 8px 0;
}
</style>
```

- [ ] **Step 3: Render the panel in the sidebar**

In `packages/desktop/src/renderer/src/components/sideBar/index.vue`:

Add the import near the other panel imports (~line 59):

```ts
import SourceControl from './sourceControl.vue'
```

Add the render branch in the `right-column` block after the `<toc ... />` line:

```vue
      <source-control v-else-if="rightColumn === 'source-control'" />
```

- [ ] **Step 4: Add the i18n strings**

In `packages/desktop/src/main/i18n/locales/en.json` (or the equivalent en locale source — confirm the path with `rg -l '"icons"' packages/desktop`), add a `sourceControl` key under `sideBar.icons` next to `files`/`search`/`toc`:

```json
"sourceControl": "Source Control"
```

The spec requires **all** panel strings to go through the i18n system like the
rest of the sidebar — the template listings above show hardcoded English for
readability only. Add a `sideBar.sourceControl.*` group (e.g. `signIn`,
`signedOutHint`, `cloneRepo`, `noRepo`, `commitPlaceholder`, `commit`, `sync`,
`commitFirst`, `noChanges`, `conflictTitle`, `openRepoFolder`, `lfsTitle`,
`lfsHint`, plus the toast messages) and wire the component through `t()` the
same way `tree.vue` does. The same applies to `repoBrowser.vue` in Task 11.

- [ ] **Step 5: Typecheck and run the app**

Run: `pnpm run typecheck`
Then: `pnpm run dev`
Expected: a new Source Control icon appears in the sidebar activity bar; clicking it shows the "Sign in to GitHub" view (sign-in won't complete until the OAuth App `client_id` from Task 12 is set).

- [ ] **Step 6: Commit**

```bash
git add packages/desktop/src/renderer/src/components/sideBar/sourceControl.vue packages/desktop/src/renderer/src/components/sideBar/help.ts packages/desktop/src/renderer/src/components/sideBar/index.vue packages/desktop/src/main/i18n/locales/en.json
git commit -m "feat(github): add Source Control sidebar panel"
```

---

### Task 11: Repo browser / clone modal

**Files:**
- Create: `packages/desktop/src/renderer/src/components/github/repoBrowser.vue`

- [ ] **Step 1: Implement the modal**

Create `packages/desktop/src/renderer/src/components/github/repoBrowser.vue`:

```vue
<template>
  <el-dialog
    :model-value="modelValue"
    title="GitHub repositories"
    width="520px"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <div v-if="!signedIn" class="auth">
      <p v-if="!deviceCode">Sign in to access your repositories.</p>
      <div v-else class="device">
        <p>Enter this code at <strong>{{ verificationUri }}</strong> (opened in your browser):</p>
        <p class="code">{{ deviceCode }}</p>
        <p class="hint">Waiting for authorization…</p>
      </div>
      <el-button v-if="!deviceCode" type="primary" @click="startAuth">Sign in to GitHub</el-button>
    </div>

    <div v-else>
      <el-input v-model="filter" placeholder="Filter repositories" clearable class="filter" />
      <ul class="repos">
        <li v-for="repo in filtered" :key="repo.fullName">
          <span class="name">{{ repo.fullName }}</span>
          <el-tag v-if="repo.private" size="small">private</el-tag>
          <el-button size="small" :loading="busy" @click="clone(repo)">Clone</el-button>
        </li>
        <li v-if="!filtered.length" class="none">No repositories</li>
      </ul>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { useGithubStore } from '@/store/github'
import type { GitHubRepoInfo } from '@shared/types/ipc'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const githubStore = useGithubStore()
const { signedIn, repos, busy } = storeToRefs(githubStore)

const deviceCode = ref('')
const verificationUri = ref('')
const filter = ref('')

const filtered = computed<GitHubRepoInfo[]>(() => {
  const q = filter.value.toLowerCase()
  return repos.value.filter((r) => r.fullName.toLowerCase().includes(q))
})

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return
    await githubStore.refreshAuth()
    if (signedIn.value) await githubStore.loadRepos()
  }
)

const startAuth = async (): Promise<void> => {
  const info = await githubStore.startAuth()
  deviceCode.value = info.userCode
  verificationUri.value = info.verificationUri
  // store.onAuthSuccess (wired in the store) flips signedIn + loads repos.
}

const pickTargetDir = async (): Promise<string | null> => {
  // Reuse the main-process directory chooser. cwd is a safe default parent.
  return window.electron.paths?.cwd ?? null
}

const clone = async (repo: GitHubRepoInfo): Promise<void> => {
  const targetDir = await pickTargetDir()
  if (!targetDir) {
    ElMessage.error('Could not determine a clone location.')
    return
  }
  try {
    const localPath = await githubStore.cloneRepo(repo.cloneUrl, targetDir)
    // Open the cloned folder through the existing folder-open IPC path.
    window.electron.ipcRenderer.send('mt::open-file', localPath)
    await githubStore.setRepo(localPath)
    emit('update:modelValue', false)
    ElMessage.success(`Cloned ${repo.fullName}`)
  } catch (err) {
    ElMessage.error(`Clone failed: ${(err as Error).message}`)
  }
}
</script>

<style scoped>
.repos {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  max-height: 320px;
  overflow-y: auto;
}
.repos li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--itemBgColor);
}
.repos .name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.code {
  font-family: monospace;
  font-size: 22px;
  letter-spacing: 2px;
}
.filter {
  margin-bottom: 4px;
}
.none {
  opacity: 0.6;
}
</style>
```

> **Directory chooser caveat:** `pickTargetDir` above uses `cwd` as a placeholder. If MarkText exposes a native folder-picker over IPC (search: `rg -n "showOpenDialog|select-default-directory|ask-for" packages/desktop/src/main`), wire that channel through the preload bridge and call it here instead so the user chooses where to clone. If no picker is reachable from the sandboxed renderer, add a `mt::github::choose-dir` invoke channel (Task 6 pattern) backed by `dialog.showOpenDialog({ properties: ['openDirectory'] })` in `github/ipc.ts`, and call it here. Pick the option that matches the existing folder-open flow.

- [ ] **Step 2: Verify the folder-open channel name**

Run: `rg -n "'mt::open-file'|mt::open-directory|cmd-open-folder" packages/desktop/src/main`
Expected: confirm which channel opens a folder in the current window. If `mt::open-file` does not accept a directory, use the channel that does (e.g. send `mt::cmd-open-folder` or the directory-open send channel) and update the `clone()` handler accordingly.

- [ ] **Step 3: Typecheck and run**

Run: `pnpm run typecheck && pnpm run dev`
Expected: clicking "Clone repository…" opens the modal; the sign-in flow shows a device code (full round-trip needs Task 12's `client_id`).

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src/renderer/src/components/github/repoBrowser.vue
git commit -m "feat(github): add repo browser + clone modal"
```

---

## Phase 4 — OAuth App prerequisite + docs

### Task 12: Document the OAuth App requirement and dev setup

**Files:**
- Modify: `docs/superpowers/specs/2026-06-08-github-integration-design.md` (already notes the prerequisite — no change needed)
- Create: `docs/dev/GITHUB_INTEGRATION.md`

- [ ] **Step 1: Write the setup doc**

Create `docs/dev/GITHUB_INTEGRATION.md`:

```md
# GitHub Integration — setup

The GitHub integration authenticates via the **OAuth Device Flow**, which
requires a registered GitHub OAuth App. Device flow needs no client secret, so
the `client_id` is shipped publicly in source.

## Production

1. A MarkText maintainer registers an OAuth App at
   https://github.com/settings/developers with **"Enable Device Flow"** checked.
2. Put its public client id in `packages/desktop/src/main/github/config.ts`
   (`GITHUB_CLIENT_ID`).

## Local development

Register your own throwaway OAuth App (Device Flow enabled) and run:

```bash
MARKTEXT_GITHUB_CLIENT_ID=Iv1.xxxxxxxx pnpm run dev
```

`config.ts` reads `MARKTEXT_GITHUB_CLIENT_ID` and falls back to the shipped id.

## Scope

The app requests the `repo` scope (read/write to public and private repos the
user owns). This is required for cloning private repos and pushing.

Classic OAuth App tokens do not expire; there is no refresh flow. Note that
organizations enforcing **OAuth App access restrictions** must approve the app
before their repositories are listed or pushable — until then the API omits
them and pushes return 403.
```

- [ ] **Step 2: Commit**

```bash
git add docs/dev/GITHUB_INTEGRATION.md
git commit -m "docs(github): document OAuth App setup for the integration"
```

- [ ] **Step 3: Full verification pass**

Run:

```bash
pnpm run lint
pnpm run typecheck
pnpm -C packages/desktop exec vitest run test/unit/specs/github-git.spec.ts test/unit/specs/github-auth.spec.ts test/unit/specs/github-api.spec.ts
```

Expected: lint clean, typecheck clean, all three GitHub specs pass.

- [ ] **Step 4: Manual smoke test (requires a real `client_id`)**

With `MARKTEXT_GITHUB_CLIENT_ID` set, run `pnpm run dev` and verify the full loop:
sign in (device code) → repo list loads → clone a small repo → edit a markdown
file → it appears under changes → stage + commit → sync. Then make a change on
GitHub and Sync again to confirm pull works; create a conflicting change to
confirm the conflict banner appears and the working tree is left intact.

---

## Notes & deviations from the spec

- **Testing remote ops:** The spec said tests clone from a "local file-based
  remote." isomorphic-git has **no `file://` transport**, so that is not
  possible. Instead: local operations and the safety-critical merge/conflict
  logic are tested against real temp repos (Tasks 2–3); device-flow and the REST
  client are tested with mocked `fetch` (Tasks 4–5); the network wrappers
  (`cloneRepo`/`fetchRemote`/`pushBranch`) are thin and verified in the manual
  smoke test (Task 12). A networked Playwright e2e is deferred until the OAuth
  App exists, to avoid a brittle live-GitHub dependency.
- **Directory picker:** Task 11 flags that the clone-target chooser must be
  wired to MarkText's existing native folder picker (or a new
  `mt::github::choose-dir` channel) — confirm during implementation.
- **`global.d.ts` shape:** Task 8 assumes top-level `var` globals; if the file
  uses a `Window` interface, follow that instead.
- **Design-review fixes (2026-07-01):** the spec review added: commit identity
  from the GitHub profile (`commitAuthorFor` — noreply email, cached in main,
  cleared on sign-out), a Sync dirty-guard in main **before any network I/O**
  plus renderer save-all, panel activation for any opened github.com repo via
  `detectRepo` / `mt::github::repo-info` (SSH origins rewritten to HTTPS),
  paginated `listRepos`, an LFS warning banner (`hasLfsPatterns` /
  `mt::github::lfs-check`), broadcast `mt::github::status-changed` (multi-
  window), and debounced status refresh. keytar stays for v1 despite being
  archived upstream (`GitHubAuthProvider` is the `safeStorage` migration
  seam).
- **Save-all before sync:** `editorStore.ASK_FOR_SAVE_ALL(false)` is the
  existing save-all path but returns `void` — make the store's sync action
  wait for saves to land before invoking `mt::github::sync` (see the caveat in
  Task 9). The main-process dirty guard is the safety net if a save races.
- **Design-review fixes, round 2 (2026-07-01):** per-repo operation
  serialization (`withRepoQueue` in git.ts, applied to every git handler in
  ipc.ts — isomorphic-git has no `index.lock`); offline support (identity
  persisted via `saveIdentity`/`loadIdentity`, `auth-status` answers from
  token presence with no network round-trip, commit works offline after a
  restart); a new device poll cancels any in-flight one (generation counter);
  sign-out documented as local-only (device flow cannot revoke server-side);
  `detectRepo` is repo-root-only in v1 (no upward walk); LFS detection is
  best-effort on the root `.gitattributes`; `clone-progress` is throttled in
  main; all panel strings go through i18n; dropped the misleading `depth: 0`
  from `cloneRepo`.
