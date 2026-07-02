# GitHub Integration — Design

**Date:** 2026-06-08
**Status:** Approved (design phase)
**Topic:** Turn MarkText into a lightweight git-backed markdown/docs editor that works directly against GitHub repositories.

## Summary

Let users browse their GitHub repositories from inside MarkText, clone one on
demand, edit its markdown files with the normal editor, and commit/push/pull
through a VS Code-style **Source Control** panel. The first version targets the
common single-author docs workflow: clone → edit → commit → sync. Branch
management, pull requests, and in-app merge-conflict resolution are explicitly
out of scope for v1.

## Decisions (locked during brainstorming)

| Question | Decision |
|---|---|
| Core goal | Git-backed docs editor — edit a repo's markdown files in place |
| File model | **Hybrid** — browse repos remotely, clone on demand, then work on the local clone |
| Git engine | **isomorphic-git** (pure JS; no dependency on a system `git` binary) |
| Auth | **OAuth Device Flow** (requires a registered MarkText OAuth App + shipped public `client_id`) |
| v1 workflow | **Lean**: clone, status, stage, commit, push, pull (fast-forward / clean merge); surface conflicts and pause; stay on the default branch |
| UI integration | **Source Control panel** reusing the existing open-folder / file-tree machinery |

Decisions added during design review (2026-07-01):

| Question | Decision |
|---|---|
| Which repos does the panel serve? | Any opened folder that is a git repository whose `origin` points at github.com — not only repos cloned through MarkText. SSH origins are rewritten to their HTTPS equivalent for network operations so token auth works either way. |
| Commit identity | GitHub profile, fetched at sign-in: name (falling back to login) + the noreply address `{id}+{login}@users.noreply.github.com` |
| Sync preconditions | Save-all + clean working tree required; Sync refuses otherwise (no stash in v1) |
| Token storage | Keep keytar for v1 (already shipped) even though upstream is archived; the `GitHubAuthProvider` seam allows migrating to Electron `safeStorage` later |
| Sub-folders of a repo | Root-only in v1: the opened folder itself must be the repo root — no upward walk to find `.git` |
| Offline | Local ops (status / stage / commit) must work offline: the identity is persisted at sign-in, and signed-in display relies on token presence, not a network round-trip |
| Concurrency | Main serializes all git operations per `repoPath` — isomorphic-git has no `index.lock`, so concurrent ops (two windows, or a status racing a commit) could corrupt the index |

## Existing code context

- No real GitHub integration exists today. The only touchpoints are
  `packages/desktop/src/main/utils/createGitHubIssue.ts` (opens the repo's issue
  page in a browser) and `packages/desktop/src/main/ipc/uploader.ts` (image
  uploads via the external `picgo` CLI). Neither is reused here.
- `keytar` is already a dependency (secure OS-keychain token storage available).
- MarkText already opens local folders and renders a file tree, and already
  watches open folders for changes — the Source Control panel builds on this.

## Architecture

All sensitive work (network, file system, keychain, git) runs in the **main
process**. The renderer is sandboxed and only ever receives booleans, the
authenticated username, repo metadata, and changed-file lists — **never the
token**. This preserves the existing process/sandbox boundary.

### Main process — new module `packages/desktop/src/main/github/`

One file per responsibility:

| File | Responsibility |
|---|---|
| `auth.ts` | OAuth Device Flow: request device code, poll the token endpoint (starting a new poll cancels any in-flight one — clicking "Sign in" twice must not leave two pollers racing), store/read/clear the token via keytar. Also persists the (non-secret) user identity so offline commits and signed-in display work across restarts. Implemented behind a `GitHubAuthProvider` interface so a Personal Access Token provider can be added later without touching callers. |
| `api.ts` | Minimal GitHub REST client using Node's global `fetch` (avoids the heavy `@octokit/rest` dependency): authenticated user (login, name, id — the source of the commit author), list user repositories (**paginated** — users routinely exceed one page), repo default branch. |
| `git.ts` | isomorphic-git wrapper: `clone`, `statusMatrix`, `add`/`remove`, `commit` (takes an explicit author — see Commit identity), `push`, `fetch` + merge, `currentBranch`, ahead/behind counts. Also: repo detection for opened folders (`origin` remote → github.com match, SSH→HTTPS rewrite) and Git-LFS detection (scan `.gitattributes` for `filter=lfs`). Authenticates via isomorphic-git's `onAuth` callback returning the keychain token. |
| `ipc.ts` | Registers the `mt::github::*` IPC handlers, bridges the renderer to the three modules above, and emits progress/auth events. **Serializes all git operations per `repoPath`** (a per-repo promise queue): isomorphic-git has no `index.lock`, so two windows syncing the same repo — or a watcher-driven status racing a commit — could otherwise corrupt the index. |

### Renderer

- New Pinia store `packages/desktop/src/renderer/src/store/github.ts` — holds
  auth state, the current repo's branch / ahead-behind / changed-file list, and
  the actions that call IPC.
- New components under
  `packages/desktop/src/renderer/src/components/` for the Source Control panel
  and the repo browser modal (see UX flow).
- All panel strings go through the existing i18n/locale system, like the rest
  of the sidebar — no hardcoded English.

### Commit identity

isomorphic-git's `commit` requires an author name and email, and MarkText has
no git identity of its own. At sign-in, `api.ts` fetches the user's `login`,
`name`, and `id`; commits are authored as:

- **name:** the GitHub profile name, falling back to `login`
- **email:** `{id}+{login}@users.noreply.github.com` — GitHub's noreply
  address, so commits attribute correctly without leaking a private email

The identity is **persisted at sign-in** (it is not a secret — a second keytar
entry next to the token) and supplied by `ipc.ts` when invoking `commit`. The
renderer never provides the author. Persistence matters because commit is a
purely local operation: after an app restart while offline, `getUser` cannot
run, and committing must still work.

## IPC contract

Added to `packages/desktop/src/shared/types/ipc.ts`, all under the `mt::` prefix.

**Invoke (renderer → main, async):**

- `mt::github::auth-start` → `{ userCode, verificationUri, expiresIn, interval }`
- `mt::github::auth-status` → `{ signedIn: boolean, username?: string }` —
  answered from token presence + the persisted identity, **no network
  round-trip**: an offline user must not be shown as signed out. Token
  validity is checked lazily when a network operation fails with 401.
- `mt::github::sign-out` → `void`
- `mt::github::list-repos` → repo metadata array
- `mt::github::clone` `{ repoFullName, cloneInto }` → `{ localPath }`
- `mt::github::status` `{ repoPath }` → changed-file list (staged/unstaged)
- `mt::github::stage` / `mt::github::unstage` `{ repoPath, files }` → updated status
- `mt::github::commit` `{ repoPath, message }` → `{ oid }`
- `mt::github::sync` `{ repoPath }` → `{ ok: true, ahead, behind } | { conflict: true, files } | { dirty: true }`
- `mt::github::repo-info` `{ path }` → `{ isRepo: boolean, remoteUrl?, httpsUrl? }` — drives panel activation for folders that are already GitHub clones
- `mt::github::lfs-check` `{ repoPath }` → `boolean` — powers the LFS warning

**Events (main → renderer):**

- `mt::github::auth-success` / `mt::github::auth-error`
- `mt::github::clone-progress` `{ phase, loaded, total }` — throttled in main
  (isomorphic-git fires `onProgress` extremely often; do not forward per
  callback)
- `mt::github::status-changed` `{ repoPath }`

MarkText runs one renderer per window, and two windows can have the same repo
open: `mt::github::status-changed` is therefore **broadcast to all windows**,
and each window's store ignores paths that don't match its own repo. Auth and
clone-progress events target only the initiating window.

## UX flow — Source Control panel

1. A new **Source Control** entry in the sidebar / activity bar. When signed
   out it shows "Sign in to GitHub" → device flow displays the user code and
   opens `github.com/login/device`; main polls the token endpoint; on success
   the token is written to the OS keychain.
2. **"Clone repository…"** → searchable list of the user's repos (from `api.ts`)
   → user picks a target directory → isomorphic-git clones with a progress bar
   (driven by `clone-progress`) → on completion the cloned folder is opened
   through MarkText's **existing open-folder / file-tree** machinery.
3. The panel is not limited to repos cloned through MarkText: whenever the
   opened folder is a git repository with a github.com `origin` (checked via
   `mt::github::repo-info`), the panel activates for it. The check is
   **root-only** in v1 — opening a sub-folder of a repo (e.g. `repo/docs/`)
   does not activate the panel; MarkText does not walk up parent directories
   looking for `.git`. Editing and saving
   use the existing editor. The panel relies on MarkText's existing folder
   watching to refresh and show **changed files**, grouped into staged and
   unstaged sections. Status refresh is **debounced** — `statusMatrix` walks
   the whole tree and must not run once per fs event.
4. The user stages files, types a commit message, and clicks **Commit**.
5. A **Sync** button (showing ahead/behind counts) first saves all open tabs
   under the repo and requires a clean working tree (see Sync preconditions),
   then fetches, fast-forwards / clean-merges, and pushes.

## Conflict handling (v1 — safety critical)

The overriding rule: **never leave a half-merged working tree and never lose
data silently.**

### Sync preconditions

Sync never runs against unsaved or uncommitted work — a merge/checkout over
either could clobber it:

1. The renderer saves all open tabs under the repo before invoking
   `mt::github::sync`, and refuses to sync while a tab cannot be saved.
2. Main independently re-verifies that the working tree is clean **before any
   network I/O** and returns `{ dirty: true }` otherwise; the panel shows
   "Commit your changes first." v1 has no stash / auto-stash.

Because save-all runs first, files updated by a pull can be safely reloaded
into open tabs by the existing folder watcher without racing an unsaved
buffer.

On Sync, main fetches and then inspects divergence:

- **Fast-forwardable** (local is strictly behind) → merge and push.
- **Clean merge** (diverged but no overlapping changes) → merge and push.
- **Would conflict** (diverged with overlapping changes) → **do not mutate the
  working tree.** Return `{ conflict: true, files }`. The panel shows a banner
  listing the conflicted files, explains that in-app resolution is not available
  yet, and offers "Open repo folder" so the user can resolve with their own
  tools. v1 does not write conflict markers or auto-resolve.

## Error handling

- Network errors → user-facing toast.
- Expired / revoked token → prompt to re-authenticate.
- Push rejected (non-fast-forward) → message: "Sync first."
- Clone target directory non-empty → validate before cloning.
- Large repos / binary files → supported, just slower; progress is shown.
- Org-restricted repos → organizations that enforce OAuth App access
  restrictions block the token even after a successful sign-in: their repos
  are missing from the list and pushes 403. Surface a message pointing at the
  org-approval requirement instead of a generic failure.
- Token lifetime → classic OAuth App tokens do not expire; v1 assumes this and
  has no refresh flow. (Moving to a GitHub App later would introduce expiring
  tokens + refresh handling.)
- Sign-out → deletes the local keychain entries only. Device-flow apps cannot
  revoke a token server-side (revocation requires the client secret); the
  token stays valid until the user revokes the app under GitHub settings.
  Not a bug — document it.
- Git LFS repos → isomorphic-git has no LFS support: LFS-tracked files clone
  as pointer files, and committing them would write raw content. Detect
  `filter=lfs` in the **root** `.gitattributes` at clone/open (best-effort —
  nested `.gitattributes` files are not scanned) and show a persistent
  warning. Full LFS support is out of scope.

## Testing

- **Vitest (unit):**
  - `git.ts` local operations (status / stage / commit), repo/LFS detection,
    the dirty-tree sync guard, and the safety-critical merge /
    conflict-detection logic against **real temporary repos** created with
    isomorphic-git. (Note: isomorphic-git has no `file://`
    transport, so clone/push/fetch cannot run against a local file remote —
    those network wrappers stay thin and are covered by the manual smoke test.)
  - The per-repo serialization queue (interleaved operations resolve in
    order).
  - Device-flow polling logic with fake timers and a mocked `fetch` (covers
    pending, slow-down, success, expiry, and cancellation by a newer poll).
  - Identity persistence round-trip (offline commit author).
  - REST client (`api.ts`) with a mocked `fetch` (identity fields, noreply
    author derivation, pagination).
  - IPC contract type checks.
- **Manual smoke test / deferred e2e:** the full networked round-trip (sign in →
  clone → edit → commit → sync, plus a forced conflict) is verified manually
  once the OAuth App `client_id` exists. A networked Playwright e2e is deferred
  to avoid a brittle live-GitHub dependency.

## Dependencies

- **New:** `isomorphic-git` (and its `isomorphic-git/http/node` transport),
  added to `packages/desktop/package.json`.
- **Reused:** `keytar` (already present). Upstream is archived/unmaintained —
  accepted for v1 since it already ships with MarkText; the
  `GitHubAuthProvider` seam keeps a later migration to Electron's
  `safeStorage` cheap. No new auth library.
- **Avoided:** `@octokit/rest` — native `fetch` covers the small API surface and
  keeps the bundle lean.

## Prerequisite (external action for maintainers)

- The MarkText project must **register a GitHub OAuth App** with Device Flow
  enabled and ship its **public `client_id`** in config. Device flow needs no
  client secret, so shipping the `client_id` publicly is safe. For local
  development the `client_id` can be supplied via an environment variable.
  Authentication cannot work until this exists.

## Out of scope for v1

- Branch creation / switching.
- Pull request creation or review.
- In-app merge-conflict resolution UI.
- Git LFS support (detected and warned about, not supported).
- GitHub Enterprise (endpoints are hardcoded to github.com).
- Stash / auto-stash — Sync simply refuses on a dirty working tree.
- Personal Access Token auth (the `GitHubAuthProvider` interface leaves room to
  add it later).
- Settings/theme sync, Gist publishing, and GitHub-backed image hosting (these
  were considered and deferred).
