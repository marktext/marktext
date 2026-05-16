# MarkText — CLAUDE.md

## Project Overview

MarkText is a WYSIWYG markdown editor built on Electron + Vue 3. It supports CommonMark, GitHub Flavored Markdown, math (KaTeX), Mermaid diagrams, PlantUML, and multiple editing modes (focus, typewriter, source-code).

- **Version**: 0.18.9
- **License**: MIT
- **Repository**: https://github.com/marktext/marktext

## Tech Stack

| Layer | Technology |
|---|---|
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
| Node.js minimum | >=20.19.0 (CI runs 22.21.1) |

## Directory Structure

```
src/
  common/      Pure Node.js utilities — usable from main, preload, and renderer
  main/        Electron main process (IO, native dialogs, window management, auto-updater)
  preload/     Electron preload scripts (sandboxed bridge to the renderer)
  renderer/    Vue 3 application (editor UI, Pinia stores, components)
    src/
      components/    Vue single-file components
      store/         Pinia stores (editor.js, preferences.js, layout.js, …)
      pages/         Top-level Vue pages / routes
      router/        Vue Router configuration
  muya/        Core editor backend — pure JS + DOM only (NO Electron or Node.js APIs)
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
resources/     Runtime resources (locales, ripgrep binary)
scripts/       Build utility scripts (postinstall, minify-locales, etc.)
out/           Compiled output from electron-vite (git-ignored)
dist/          Packaged installers from electron-builder (git-ignored)
```

## Development Workflow

```bash
# Install dependencies
pnpm install

# Run in development mode
# Renderer hot-reloads automatically; press Ctrl+R to reload main/preload after edits
pnpm run dev

# Minify locale files (required for production builds, skip during dev)
pnpm run minify-locales
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
pnpm run lint          # ESLint (must pass before merge)
```

## Code Style

Enforced by ESLint + Prettier. Run `pnpm run lint` before committing.

- 2-space indentation
- No semicolons
- Single quotes
- ES6+ throughout
- JSDoc for public APIs

## Architecture: Three-Process Electron Model

```
main process  (src/main/)
  ├── Full Node.js + Electron API access
  ├── IO, file system, native dialogs, auto-updater, spell checker
  ├── One instance per application launch
  └── Controls editor windows via IPC

preload  (src/preload/)
  ├── Sandboxed bridge — exposes a minimal API surface to the renderer
  └── Compiled to CommonJS

renderer  (src/renderer/)
  ├── One process per editor window (spawned by main)
  ├── Vue 3 + Pinia — all UI state and editor interaction
  ├── Hosts both Muya (WYSIWYG) and CodeMirror (source-code mode)
  └── Compiled to ES Modules only

Muya  (src/muya/)
  ├── Self-contained editor backend
  ├── Pure JS + DOM APIs — no Electron or Node.js imports allowed
  └── Handles markdown parsing, block data structure, document export, rendering
```

## IPC Conventions

All IPC channels between main and renderer use the `mt::` prefix.

Examples: `mt::open-new-tab`, `mt::file-saved`, `mt::user-preference`

See `docs/dev/IPC.md` for the full channel list and argument conventions.

## Important Build Notes

- **CommonJS vs ESM**: `main` and `preload` compile to CommonJS; `renderer` is ESM-only. Do not use `require()` in renderer code.
- **Minify locales**: `pnpm run minify-locales` must run before production builds. It is included in `build:win/mac/linux` but not in `dev`.
- **Native modules**: After changing Electron version, run `pnpm run rebuild-native` (`electron-rebuild -f`).
- **Hot reload**: Only the renderer process hot-reloads in dev mode. After editing `main/` or `preload/` source, press `Ctrl+R` in the development window.
- **Path aliases**: `@` → `src/renderer/src`, `common` → `src/common`, `muya` → `src/muya/lib` (defined in `electron.vite.config.js`).

## Contribution

- Submit PRs to the **`develop`** branch (not `main`).
- Reference the related issue in the PR description.
- Run `pnpm run lint` before submitting — CI enforces this.
- All PRs must pass CI before merge.
- See `.github/CONTRIBUTING.md` for the full contributing guide.
