# MarkText — CLAUDE.md

## Project Overview

MarkText is a WYSIWYG markdown editor built on Electron + Vue 3. It supports CommonMark, GitHub Flavored Markdown, math (KaTeX), Mermaid diagrams, PlantUML, and multiple editing modes (focus, typewriter, source-code).

- **Version**: see `package.json`
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
| Node.js minimum | >=20.19.0 (PR CI: Node 22.21.1 · release CI: Node 24.14.1) |

## Directory Structure

```
src/
  common/      Pure Node.js utilities — usable from main, preload, and renderer
  main/        Electron main process (IO, native dialogs, window management, auto-updater)
  preload/     Electron preload scripts (bridge to the renderer; note: contextIsolation is
               currently disabled and nodeIntegration is enabled for editor windows)
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
pnpm run lint          # ESLint (run before committing; not currently enforced by CI)
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

## Important Build Notes

- **CommonJS vs ESM**: `main` and `preload` compile to CommonJS; `renderer` is ESM-only. Do not use `require()` in renderer code.
- **Minify locales**: `pnpm run minify-locales` must run before production builds. It is included in `build:win/mac/linux` but not in `dev`.
- **Native modules**: After changing Electron version, run `pnpm run rebuild-native` (`electron-rebuild -f`).
- **Hot reload**: Only the renderer process hot-reloads in dev mode. After editing `main/` or `preload/` source, press `Ctrl+R` in the development window.
- **Path aliases** (defined in `electron.vite.config.js`): `@` → `src/renderer/src`, `common` → `src/common`, `muya` → `src/muya`. Imports from muya therefore look like `muya/lib/...`.

## Contribution

- Submit PRs to the **`develop`** branch (not `main`).
- Reference the related issue in the PR description.
- Run `pnpm run lint` before submitting.
- All PRs must pass CI before merge.
- See `.github/CONTRIBUTING.md` for the full contributing guide.
