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
| `auth.ts` | OAuth Device Flow: request device code, poll the token endpoint, store/read/clear the token via keytar. Implemented behind a `GitHubAuthProvider` interface so a Personal Access Token provider can be added later without touching callers. |
| `api.ts` | Minimal GitHub REST client using Node 20's global `fetch` (avoids the heavy `@octokit/rest` dependency): authenticated user, list user repositories, repo default branch. |
| `git.ts` | isomorphic-git wrapper: `clone`, `statusMatrix`, `add`/`remove`, `commit`, `push`, `fetch` + merge, `currentBranch`, ahead/behind counts. Authenticates via isomorphic-git's `onAuth` callback returning the keychain token. |
| `ipc.ts` | Registers the `mt::github::*` IPC handlers, bridges the renderer to the three modules above, and emits progress/auth events. |

### Renderer

- New Pinia store `packages/desktop/src/renderer/src/store/github.ts` — holds
  auth state, the current repo's branch / ahead-behind / changed-file list, and
  the actions that call IPC.
- New components under
  `packages/desktop/src/renderer/src/components/` for the Source Control panel
  and the repo browser modal (see UX flow).

## IPC contract

Added to `packages/desktop/src/shared/types/ipc.ts`, all under the `mt::` prefix.

**Invoke (renderer → main, async):**

- `mt::github::auth-start` → `{ userCode, verificationUri, expiresIn, interval }`
- `mt::github::auth-status` → `{ signedIn: boolean, username?: string }`
- `mt::github::sign-out` → `void`
- `mt::github::list-repos` → repo metadata array
- `mt::github::clone` `{ repoFullName, cloneInto }` → `{ localPath }`
- `mt::github::status` `{ repoPath }` → changed-file list (staged/unstaged)
- `mt::github::stage` / `mt::github::unstage` `{ repoPath, files }` → updated status
- `mt::github::commit` `{ repoPath, message }` → `{ oid }`
- `mt::github::sync` `{ repoPath }` → `{ ok: true, ahead, behind } | { conflict: true, files }`

**Events (main → renderer):**

- `mt::github::auth-success` / `mt::github::auth-error`
- `mt::github::clone-progress` `{ phase, loaded, total }`
- `mt::github::status-changed` `{ repoPath }`

## UX flow — Source Control panel

1. A new **Source Control** entry in the sidebar / activity bar. When signed
   out it shows "Sign in to GitHub" → device flow displays the user code and
   opens `github.com/login/device`; main polls the token endpoint; on success
   the token is written to the OS keychain.
2. **"Clone repository…"** → searchable list of the user's repos (from `api.ts`)
   → user picks a target directory → isomorphic-git clones with a progress bar
   (driven by `clone-progress`) → on completion the cloned folder is opened
   through MarkText's **existing open-folder / file-tree** machinery.
3. Editing and saving use the existing editor. The panel relies on MarkText's
   existing folder watching to refresh and show **changed files**, grouped into
   staged and unstaged sections.
4. The user stages files, types a commit message, and clicks **Commit**.
5. A **Sync** button (showing ahead/behind counts) fetches, then
   fast-forwards / clean-merges and pushes.

## Conflict handling (v1 — safety critical)

The overriding rule: **never leave a half-merged working tree and never lose
data silently.**

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

## Testing

- **Vitest (unit):**
  - `git.ts` local operations (status / stage / commit) and the
    safety-critical merge / conflict-detection logic against **real temporary
    repos** created with isomorphic-git. (Note: isomorphic-git has no `file://`
    transport, so clone/push/fetch cannot run against a local file remote —
    those network wrappers stay thin and are covered by the manual smoke test.)
  - Device-flow polling logic with fake timers and a mocked `fetch` (covers
    pending, slow-down, success, and expiry).
  - REST client (`api.ts`) with a mocked `fetch`.
  - IPC contract type checks.
- **Manual smoke test / deferred e2e:** the full networked round-trip (sign in →
  clone → edit → commit → sync, plus a forced conflict) is verified manually
  once the OAuth App `client_id` exists. A networked Playwright e2e is deferred
  to avoid a brittle live-GitHub dependency.

## Dependencies

- **New:** `isomorphic-git` (and its `isomorphic-git/http/node` transport),
  added to `packages/desktop/package.json`.
- **Reused:** `keytar` (already present). No new auth library.
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
- Personal Access Token auth (the `GitHubAuthProvider` interface leaves room to
  add it later).
- Settings/theme sync, Gist publishing, and GitHub-backed image hosting (these
  were considered and deferred).
