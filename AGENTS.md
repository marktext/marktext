# Repository Guidelines

## Scope
These instructions apply to the entire repository. They are aligned with
`CLAUDE.md` and `.github/CONTRIBUTING.md`.

## Operating Rules
- Modify only what was explicitly requested.
- Before editing, name the exact file(s) you will touch and the intended change.
- Preserve existing architecture, naming, conventions, and style.
- Avoid unrelated features, broad refactors, and whole-file reformatting.
- Do not rename files, functions, classes, or variables unless requested.
- After editing, list modified files, summarize changes, and flag uncertainty.
- For code, library, framework, API, config, or dependency questions, use Context7 first; prefer official or Context7 documentation over memory.

## Project Snapshot
MarkText is a WYSIWYG Markdown editor built as a pnpm monorepo.

- Desktop app: Electron 42 + Vue 3 in `packages/desktop/`
- Markdown engine: legacy Muya package in `packages/muyajs/`
- Website: Vite + React 18 in `packages/website/`
- Language: TypeScript 5.9 strict mode; `packages/muyajs/` remains mostly JS
- State/UI: Pinia 3, Vue Router 4, Element Plus
- Build: electron-vite 5, electron-builder 26
- Tests: Vitest 4 and Playwright
- Package manager: `pnpm >=10`, root `packageManager: pnpm@10.33.4`
- Node.js: `>=20.19.0`

## Repository Layout
```text
package.json              root workspace scripts proxy to packages/desktop
pnpm-workspace.yaml       packages/* workspace
eslint.config.js          root ESLint v9 flat config
scripts/                  workspace scripts targeting packages/desktop
docs/                     developer documentation
dist/                     packaged installers from electron-builder
packages/
  desktop/                Electron app package, name: marktext
  muyajs/                 workspace package @marktext/muyajs
  website/                standalone website package
```

## Architecture Notes
- `packages/desktop/src/main/`: Electron main process, IO, native dialogs, windows, auto-updater, spell checker.
- `packages/desktop/src/preload/`: bridge between main and renderer.
- `packages/desktop/src/renderer/`: Vue UI, Muya WYSIWYG editor, CodeMirror source-code mode.
- `packages/muyajs/`: markdown parsing, block model, rendering, export; imported through the `muya` alias.
- Main and preload compile to CommonJS; renderer is ESM-only. Do not use `require()` in renderer code.
- Renderer Node access must go through the preload/contextBridge surface.
- Cross-process types live in `packages/desktop/src/shared/types/`; ambient declarations live in `packages/desktop/src/types/`.
- IPC contracts live in `packages/desktop/src/shared/types/ipc.ts`; most main/renderer channels use the `mt::` prefix.

## Style
- 2-space indentation
- No semicolons
- Single quotes
- ES6 and best practices
- TypeScript strict mode where applicable
- Use JSDoc where it improves code documentation
- Keep changes clean, simple, and minimal

## Commands
Run from the repository root unless package context is needed.

```bash
pnpm install
pnpm run dev
pnpm run start
pnpm run build:unpack
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run test:unit
pnpm run test:e2e
```

Package-specific commands:

```bash
pnpm --filter marktext <script>
pnpm -C packages/desktop <command>
pnpm --filter marktext-website <script>
```

Build commands:

```bash
pnpm run build:win
pnpm run build:mac
pnpm run build:linux
```

## Testing
- `pnpm run lint` and `pnpm run typecheck` are CI-enforced.
- Unit tests use Vitest; E2E tests use Playwright.
- For a single desktop unit spec, run from the desktop package context:

```bash
pnpm -C packages/desktop exec vitest run test/unit/specs/markdown-basic.spec.ts
pnpm -C packages/desktop exec vitest run -t 'partial test name'
```

- For a single Playwright spec:

```bash
pnpm -C packages/desktop exec playwright test test/e2e/launch.spec.ts
pnpm -C packages/desktop exec playwright test -g 'partial test name'
```

## Build Notes
- `pnpm run minify-locales` must run before production builds; platform build scripts include it, `dev` does not.
- After changing Electron, run `pnpm run rebuild-native`.
- Renderer changes hot-reload through Vite; main-process changes require restarting `pnpm run dev`.
- electron-builder writes installers to root `dist/`; electron-vite output stays in `packages/desktop/out/`.
- Path aliases are defined in `packages/desktop/electron.vite.config.ts` and mirrored in Vitest and TypeScript config:
- `@` maps to `packages/desktop/src/renderer/src`
- `common` maps to `packages/desktop/src/common`
- `@shared` maps to `packages/desktop/src/shared`
- `muya` maps to `packages/muyajs`
- pnpm patches live in `packages/desktop/patches/`; root `postinstall` runs patch-package with `cwd=packages/desktop`.

## Contribution
- Submit PRs directly to `develop`, not `main`.
- Reference the related issue in the PR description or comment.
- Describe the problem clearly; include screenshots or screen recordings for UI changes.
- For new features, open a suggestion issue first and explain the reasoning.
- For bug fixes tied to an issue, use a PR title like `fix: #<issue number> <short message>`.
- Ensure tests pass, run `pnpm run lint`, and wait for CI before merge.
- See `.github/CONTRIBUTING.md` for the full contributing guide.

## Further Reading
- `docs/dev/README.md`
- `docs/dev/ARCHITECTURE.md`
- `docs/dev/BUILD.md`
- `docs/dev/DEBUGGING.md`
- `docs/dev/INTERFACE.md`
- `docs/dev/IPC.md`
- `docs/dev/LINUX_DEV.md`
- `docs/dev/PERFORMANCE.md`
- `docs/dev/RELEASE.md`
- `docs/dev/RELEASE_HOTFIX.md`