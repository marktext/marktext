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

## Architecture

All git / auth / network / keychain work runs in the **main process** under
`packages/desktop/src/main/github/`:

| File | Responsibility |
|---|---|
| `config.ts` | OAuth `client_id` (env-overridable) + endpoint/keytar constants. |
| `auth.ts` | Device Flow (device code, polling with cancellation), token + identity storage via keytar. |
| `api.ts` | Minimal REST client over global `fetch`: authenticated user, paginated repo list, `commitAuthorFor` (noreply identity). |
| `git.ts` | isomorphic-git wrapper: status/stage/commit, repo + LFS detection, per-repo serialization queue, and the safety-critical sync (dirty guard → fetch → ff / clean-merge / conflict → push). |
| `ipc.ts` | `registerGitHubHandlers()` — wires the `mt::github::*` channels, serializes ops per repo, broadcasts `status-changed`, and opens cloned folders through the existing folder-open path. |

The sandboxed renderer drives everything through the typed bridge
(`window.github.*`) and **never receives the token**. The Pinia store
(`src/renderer/src/store/github.ts`) holds auth/repo/change state; the Source
Control sidebar panel (`components/sideBar/sourceControl.vue`) and the clone
modal (`components/github/repoBrowser.vue`) render it.

## Testing

Unit tests live in `packages/desktop/test/unit/specs/github-*.spec.ts` and are
gated at 90%+ coverage (`vitest --coverage`, scoped to `src/main/github/**` and
`store/github.ts` in `vitest.config.ts`). Local git operations and the
merge/conflict logic run against **real temporary repos**; the network
wrappers, device flow, and REST client use mocked `fetch` / isomorphic-git
(isomorphic-git has no `file://` transport). The full networked round-trip
(sign in → clone → edit → commit → sync, plus a forced conflict) is verified
manually once a real `client_id` exists; a networked Playwright e2e is deferred
to avoid a brittle live-GitHub dependency.
