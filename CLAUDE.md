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
| Language | TypeScript 5.9 (strict mode) — `src/muya/` retained as JS via ambient shim |
| Desktop shell | Electron 42 |
| Build system | electron-vite 5 |
| Packaging | electron-builder 26 |
| Frontend framework | Vue 3 |
| State management | Pinia 3 |
| Routing | Vue Router 4 |
| UI library | Element Plus |
| Unit tests | Vitest 4 |
| E2E tests | Playwright |
| Package manager | pnpm >=10 (`packageManager: pnpm@10.33.4`) |
| Node.js minimum | >=20.19.0 (PR CI: Node 22.21.1 · release CI: Node 24.14.1) |

## Directory Structure

```
src/
  common/      Pure Node.js utilities — usable from main, preload, and renderer
  main/        Electron main process (IO, native dialogs, window management, auto-updater)
  preload/     Electron preload scripts (bridge to the renderer; renderer runs sandboxed
               with contextIsolation: true, nodeIntegration: false, sandbox: true
               since #4244 — all Node access flows through the typed contextBridge
               surface in src/preload/index.ts)
  renderer/    Vue 3 application (editor UI, Pinia stores, components)
    src/
      components/    Vue single-file components
      store/         Pinia stores (editor.js, preferences.js, layout.js, …)
      pages/         Top-level Vue pages / routes
      router/        Vue Router configuration
  muya/        Core editor backend — primarily JS + DOM; avoids Electron APIs.
               Exception: src/muya/lib/parser/render/plantuml.js imports Node's `zlib`.
    lib/
      contentState/  Block structure and document transformations
      parser/        Markdown parser
      renderers/     WYSIWYG renderer
      ui/            Muya UI overlays (inline toolbar, emoji picker, etc.)
      utils/         Internal utilities

test/
  unit/        Vitest unit tests  → pnpm run test:unit
  e2e/         Playwright E2E tests → pnpm run test:e2e

static/        Static assets bundled into the app (icons, themes)
build/         electron-builder resources (icons, entitlements, NSIS script)
scripts/       Build utility scripts (postinstall, minify-locales, etc.)
out/           Compiled output from electron-vite (git-ignored)
dist/          Packaged installers from electron-builder (git-ignored)
```

## Development Workflow

```bash
# Install dependencies (runs scripts/postinstall.js automatically)
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
```

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
pnpm run lint          # ESLint (run before committing; not currently enforced by CI)
pnpm run typecheck     # vue-tsc --noEmit (run before committing; CI enforces)

# Run a single Vitest file or test name (specs live under test/unit/specs/)
pnpm exec vitest run test/unit/specs/markdown-basic.spec.js
pnpm exec vitest run -t 'partial test name'

# Run a single Playwright spec or a named test (specs live directly under test/e2e/)
pnpm exec playwright test test/e2e/launch.spec.js
pnpm exec playwright test -g 'partial test name'
```

## Code Style

Enforced by ESLint + Prettier. Run `pnpm run lint` and `pnpm run typecheck` before committing.

- 2-space indentation
- No semicolons
- Single quotes
- TypeScript with `strict: true`; see `docs/dev/TYPESCRIPT.md`
- Cross-process types live in `src/shared/types/`; ambient declarations in `src/types/`
- IPC channels are typed via the contract in `src/shared/types/ipc.ts`
- The renderer is fully sandboxed — every IPC and Node access goes through `window.electron.*` / `window.fileUtils.*` etc. (typed in `src/types/global.d.ts`)

## Architecture: Three-Process Electron Model

```
main process  (src/main/)
  ├── Full Node.js + Electron API access
  ├── IO, file system, native dialogs, auto-updater, spell checker
  ├── One instance per application launch
  └── Controls editor windows via IPC

preload  (src/preload/)
  ├── Bridge between main and renderer
  ├── Note: editor and preferences windows use contextIsolation: false +
  │   nodeIntegration: true (see src/main/config.js)
  └── Compiled to CommonJS

renderer  (src/renderer/)
  ├── One process per editor window (spawned by main)
  ├── Vue 3 + Pinia — all UI state and editor interaction
  ├── Hosts both Muya (WYSIWYG) and CodeMirror (source-code mode)
  └── Compiled to ES Modules only

Muya  (src/muya/)
  ├── Self-contained editor backend
  ├── Primarily avoids Electron APIs; uses Node's zlib for PlantUML encoding
  └── Handles markdown parsing, block data structure, document export, rendering
```

## IPC Conventions

Most IPC channels between main and renderer use the `mt::` prefix (e.g. `mt::open-new-tab`, `mt::file-saved`). Some internal channels do not follow this convention (e.g. `language-changed`).

See `docs/dev/IPC.md` for conventions and examples.

## Further Reading

`docs/dev/` contains the deeper developer documentation referenced by this guide:

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
- **Path aliases** (defined in `electron.vite.config.js`): `@` → `src/renderer/src`, `common` → `src/common`, `muya` → `src/muya`. Imports from muya therefore look like `muya/lib/...`.

## Contribution

- Submit PRs to the **`develop`** branch (not `main`).
- Reference the related issue in the PR description.
- Run `pnpm run lint` before submitting.
- All PRs must pass CI before merge.
- See `.github/CONTRIBUTING.md` for the full contributing guide.
