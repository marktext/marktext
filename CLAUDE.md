# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# MarkText

## Project Overview

MarkText is a WYSIWYG markdown editor built on Electron + Vue 3. It supports CommonMark, GitHub Flavored Markdown, math (KaTeX), Mermaid diagrams, PlantUML, and multiple editing modes (focus, typewriter, source-code).

- **Version**: see `package.json`
- **License**: MIT
- **Repository**: https://github.com/marktext/marktext

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript 5.9 (strict mode) — `packages/muyajs/` retained as JS via ambient shim |
| Desktop shell | Electron 42 |
| Build system | electron-vite 5 |
| Packaging | electron-builder 26 |
| Frontend framework | Vue 3 |
| State management | Pinia 3 |
| Routing | Vue Router 4 |
| UI library | Element Plus |
| Unit tests | Vitest 4 |
| E2E tests | Playwright |
| Package manager | pnpm >=10 workspace (`packageManager: pnpm@10.33.4`) |
| Repo layout | pnpm monorepo — see Directory Structure |
| Node.js minimum | >=20.19.0 (PR CI: Node 22.21.1 · release CI: Node 24.14.1) |

## Directory Structure

This is a pnpm workspace. Three packages live under `packages/`, and the
root holds only shared tooling and CI-facing scripts.

```
<repo-root>/
  package.json              Workspace orchestrator — every CI-facing script
                            proxies to packages/desktop via `pnpm --filter
                            marktext ...`. CI invocations are unchanged.
  pnpm-workspace.yaml       `packages: ['packages/*']` plus allowBuilds.
  pnpm-lock.yaml            Single lockfile, shared across all packages.
  eslint.config.js          Root ESLint v9 flat config (covers desktop +
                            muyajs; website has its own ESLint v8 config
                            and is ignored here).
  scripts/                  Workspace-level scripts. postinstall.ts,
                            minify-locales.ts, generateThirdPartyLicense.ts,
                            validateLicenses.ts, thirdPartyChecker.ts all
                            target packages/desktop internally.
  docs/                     Long-form developer docs.
  dist/                     Packaged installers from electron-builder
                            (git-ignored; electron-builder writes here via
                            `directories.output: ../../dist` so CI artifact
                            globs `dist/*` still apply).
  packages/
    desktop/                The Electron app (name: "marktext").
      package.json          Holds all Electron / Vue / build-time deps and
                            the dev/build/test/typecheck scripts. Depends on
                            @marktext/muyajs via workspace:*.
      electron.vite.config.ts
      electron-builder.yml  directories.output points at ../../dist.
      tsconfig.json / tsconfig.base.json
      vitest.config.ts
      patches/              pnpm patches consumed by patch-package.
      build/                electron-builder resources (icons, entitlements,
                            NSIS scripts).
      static/               Static assets bundled into the app
                            (icons, themes, locales).
      out/                  electron-vite output (git-ignored).
      test/
        unit/               Vitest specs → pnpm test / pnpm test:unit
        e2e/                Playwright specs + playwright.config.ts
                            → pnpm test:e2e
      src/
        common/             Pure Node.js utilities usable from main, preload,
                            and renderer.
        main/               Electron main process (IO, native dialogs, window
                            management, auto-updater).
        preload/            Electron preload scripts. The renderer runs
                            sandboxed (contextIsolation: true,
                            nodeIntegration: false, sandbox: true since
                            #4244) — all Node access flows through the typed
                            contextBridge surface in
                            packages/desktop/src/preload/index.ts.
        renderer/           Vue 3 application (editor UI, Pinia stores).
          src/
            components/     Vue single-file components.
            store/          Pinia stores (editor.ts, preferences.ts,
                            layout.ts, …).
            pages/          Top-level Vue pages / routes.
            router/         Vue Router configuration.
        shared/             Cross-process types (`shared/types/`) and the
                            IPC contract (`shared/types/ipc.ts`).
        types/              Ambient .d.ts declarations.
    muyajs/                 Legacy markdown editor engine
                            (name: "@marktext/muyajs"). Primarily JS + DOM,
                            avoids Electron APIs. Exception:
                            packages/muyajs/lib/parser/render/plantuml.js
                            imports Node's `zlib`. Being retired: the
                            desktop renderer now consumes @muyajs/core
                            (packages/muya) as its editor engine; only a
                            handful of legacy `muya/` alias call sites
                            remain (see #4244 era sandbox work for the
                            boundary tightening).
      lib/
        contentState/       Block structure and document transformations.
        parser/             Markdown parser.
        renderers/          WYSIWYG renderer.
        ui/                 Inline toolbar, emoji picker, etc.
        utils/              Internal utilities.
      themes/               Editor themes (Prism + fonts).
    muya/                   TypeScript rewrite of muya
                            (name: "@muyajs/core"; upstream:
                            https://github.com/marktext/muya). Built on
                            ot-json1 + ot-text-unicode + snabbdom + marked@16
                            + rxjs. Self-contained: own eslint config
                            (antfu), own stylelint, own madge, own vitest
                            spec suites (CommonMark + GFM). Now the editor
                            engine the desktop renderer consumes; legacy
                            packages/muyajs is being retired. See
                            packages/muya/CLAUDE.md for layout and commands.
      src/                  TS source. Public entrypoint src/index.ts.
      test/spec/            CommonMark 0.31 + GFM 0.29-gfm conformance.
      examples/             muya-examples — vite vanilla-TS dev demo
                            (listed in pnpm-workspace.yaml).
      e2e/                  muya-e2e — Playwright suite. CI runs Chromium
                            only via muya-e2e.yml; Firefox + WebKit are
                            wired in playwright.config.ts but deferred
                            until BACKLOG Phase 3 lands engine-independent
                            specs.
    website/                marktext-website (Vite + React 18). Standalone
                            toolchain; depends on @muyajs/core from npm,
                            not on the local muyajs package. Not part of
                            desktop CI today.
      src/ / public/ / build/ / vite.config.ts / tsconfig.json
```

The root has no `src/`, `test/`, `static/`, or `build/` of its own anymore — they all live in `packages/desktop/`.

## Development Workflow

All commands run from the repo root. The root `package.json` proxies every
desktop-specific script to `packages/desktop` via `pnpm --filter marktext`,
so the names and behavior are unchanged from the pre-monorepo layout.

```bash
# Install dependencies (runs scripts/postinstall.ts automatically — patches
# native-keymap, downloads Electron, rebuilds native modules, minifies locales)
pnpm install

# Run in development mode
# Renderer hot-reloads automatically. Pressing Ctrl+R in the dev window reloads
# the renderer (which re-runs the preload script); changes to the main process
# require restarting `pnpm run dev`.
pnpm run dev

# Preview the last electron-vite build (no rebuild). PERF_TESTING=true is set automatically.
pnpm run start

# Build without packaging — fast path for verifying the renderer/main compile
pnpm run build:unpack

# Auto-format the repo with Prettier (separate from `lint`, which only checks)
pnpm run format

# Minify locale files (required for production builds, skip during dev)
pnpm run minify-locales

# Performance debugging — exposes a Node inspector on :5858 against the previewed build
pnpm run perf:inspect       # attach when ready
pnpm run perf:inspect-brk   # break on first line

# Website (not yet wired into CI)
pnpm --filter marktext-website dev      # Vite dev server
pnpm --filter marktext-website build    # static build → packages/website/build/
```

If you need to invoke a script directly inside a package, use
`pnpm --filter <name> <script>` or `pnpm -C packages/<name> <script>`.

## Build Commands

```bash
pnpm run build:win    # Windows x64 — NSIS installer + zip
pnpm run build:mac    # macOS x64 + arm64 — DMG + zip
pnpm run build:linux  # Linux — AppImage, snap, deb, rpm, tar.gz
```

All platform build scripts automatically run `minify-locales` and `electron-rebuild` before packaging.

## Testing

```bash
pnpm run test          # All unit tests (Vitest)
pnpm run test:unit     # Unit tests only
pnpm run test:e2e      # End-to-end tests (Playwright)
pnpm run lint          # ESLint (run before committing; CI enforces)
pnpm run typecheck     # vue-tsc --noEmit (CI enforces)

# Run a single spec — paths are relative to packages/desktop. Use `-C` so
# pnpm resolves the spec path inside the desktop package's vitest config.
pnpm -C packages/desktop exec vitest run test/unit/specs/markdown-basic.spec.ts
pnpm -C packages/desktop exec vitest run -t 'partial test name'

# Single Playwright spec (playwright.config.ts lives in test/e2e/)
pnpm -C packages/desktop exec playwright test test/e2e/launch.spec.ts
pnpm -C packages/desktop exec playwright test -g 'partial test name'
```

## Code Style

Enforced by ESLint + Prettier. Run `pnpm run lint` and `pnpm run typecheck` before committing.

- 2-space indentation
- No semicolons
- Single quotes
- TypeScript with `strict: true`; see `packages/website/content/docs/dev/TYPESCRIPT.md`
- Cross-process types live in `packages/desktop/src/shared/types/`; ambient declarations in `packages/desktop/src/types/`
- IPC channels are typed via the contract in `packages/desktop/src/shared/types/ipc.ts`
- The renderer is fully sandboxed — every IPC and Node access goes through `window.electron.*` / `window.fileUtils.*` etc. (typed in `packages/desktop/src/types/global.d.ts`)

## Architecture: Three-Process Electron Model

All Electron processes live in `packages/desktop/`. Muya is a separate
workspace package that the renderer (and tests) consume via the `muya`
alias / `@marktext/muyajs` workspace dep.

```
main process  (packages/desktop/src/main/)
  ├── Full Node.js + Electron API access
  ├── IO, file system, native dialogs, auto-updater, spell checker
  ├── One instance per application launch
  └── Controls editor windows via IPC

preload  (packages/desktop/src/preload/)
  ├── Bridge between main and renderer
  ├── Note: editor and preferences windows use contextIsolation: false +
  │   nodeIntegration: true (see packages/desktop/src/main/config.js)
  └── Compiled to CommonJS

renderer  (packages/desktop/src/renderer/)
  ├── One process per editor window (spawned by main)
  ├── Vue 3 + Pinia — all UI state and editor interaction
  ├── Hosts both Muya (WYSIWYG) and CodeMirror (source-code mode)
  └── Compiled to ES Modules only

Muya  (packages/muyajs/)            ← workspace package @marktext/muyajs
  ├── Self-contained editor backend
  ├── Primarily avoids Electron APIs; uses Node's zlib for PlantUML encoding
  ├── Handles markdown parsing, block data structure, document export, rendering
  └── packages/muya/ (@muyajs/core, the TS rewrite from
      https://github.com/marktext/muya) has landed and is now the engine
      the desktop renderer consumes; muyajs is being retired.
```

## IPC Conventions

Most IPC channels between main and renderer use the `mt::` prefix (e.g. `mt::open-new-tab`, `mt::file-saved`). Some internal channels do not follow this convention (e.g. `language-changed`).

See `packages/website/content/docs/dev/IPC.md` for conventions and examples.

## Further Reading

`packages/website/content/docs/dev/` contains the deeper developer documentation referenced by this guide. Same files are published as the developer docs section on https://marktext.me/docs/dev/overview:

- `ARCHITECTURE.md` — process/module layering beyond the summary above
- `BUILD.md` — full platform build prerequisites (including the Arch Linux deps added recently)
- `DEBUGGING.md` — attaching debuggers to main/renderer processes
- `INTERFACE.md` — Muya and renderer public interfaces
- `IPC.md` — full IPC channel catalog and `mt::` conventions
- `LINUX_DEV.md` — Linux-specific dev environment setup
- `PERFORMANCE.md` — perf measurement workflow (pairs with `pnpm run perf:inspect`)
- `RELEASE.md` / `RELEASE_HOTFIX.md` — release process

## Important Build Notes

- **CommonJS vs ESM**: `main` and `preload` compile to CommonJS; `renderer` is ESM-only. Do not use `require()` in renderer code.
- **Minify locales**: `pnpm run minify-locales` must run before production builds. It is included in `build:win/mac/linux` but not in `dev`.
- **Native modules**: After changing Electron version, run `pnpm run rebuild-native` (`electron-rebuild -f`).
- **Hot reload**: The renderer hot-reloads via Vite HMR. `Ctrl+R` in the dev window reloads the renderer and re-runs the preload script. Changes to `main/` source are NOT picked up by a window reload — restart `pnpm run dev` to pick them up.
- **electron-builder output**: `directories.output` in `packages/desktop/electron-builder.yml` is set to `../../dist` so installers land in the repo-root `dist/` (where CI artifact globs look for them). `out/` from electron-vite stays inside `packages/desktop/`.
- **Path aliases** (defined in `packages/desktop/electron.vite.config.ts`, mirrored in `vitest.config.ts` and `tsconfig.base.json`):
  - `@` → `packages/desktop/src/renderer/src`
  - `common` → `packages/desktop/src/common`
  - `@shared` → `packages/desktop/src/shared`
  - `muya` → `../muyajs` (i.e. `packages/muyajs`). Renderer-side imports therefore look like `muya/lib/...` (the alias) — the workspace dep `@marktext/muyajs` is declared in `packages/desktop/package.json` so module resolution stays inside the workspace.
- **Workspace deps**: muya's own npm runtime deps (`github-markdown-css`, `katex`, `dompurify`, `snabbdom`, …) are declared in `packages/muyajs/package.json` so Node module resolution from `packages/muyajs/lib/*.js` finds them inside the workspace rather than walking out to a parent directory.
- **Patches**: `patch-package` patches live at `packages/desktop/patches/`. The root `postinstall` calls patch-package with `cwd=packages/desktop` so the path resolves correctly.

## Contribution

- Submit PRs to the **`develop`** branch (not `main`).
- Reference the related issue in the PR description.
- Run `pnpm run lint` before submitting.
- All PRs must pass CI before merge.
- See `.github/CONTRIBUTING.md` for the full contributing guide.
