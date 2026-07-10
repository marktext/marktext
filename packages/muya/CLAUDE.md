# CLAUDE.md (packages/muya)

This file provides guidance to Claude Code when working inside `packages/muya`.

> **Location.** `packages/muya` is the TypeScript rewrite of muya (upstream: <https://github.com/marktext/muya>), migrated into this marktext monorepo and published as `@muyajs/core`. The desktop renderer now consumes `@muyajs/core` as its editor engine; the legacy JS engine `packages/muyajs` (`@marktext/muyajs`, the `muya/` alias) is being retired and only a handful of call sites still reference it. `packages/muya` keeps its own toolchain (ESLint/antfu, stylelint, madge, vitest), and the marktext-root ESLint ignores `packages/muya/**` — treat it as a self-contained package with its own conventions.

## Layout inside `packages/muya`

- `src/` — `@muyajs/core` TypeScript source. Public API entrypoint is `src/index.ts`.
- `test/spec/` — CommonMark / GFM conformance suites (run via `test:spec`, separate vitest config).
- `examples/` — `muya-examples`, a Vite vanilla-TS demo that consumes `@muyajs/core` via `workspace:*`. Listed as its own workspace in the repo-root `pnpm-workspace.yaml`.
- `e2e/` — `muya-e2e`, Playwright real-browser E2E suite. Self-contained host page under `e2e/host/`. See `e2e/README.md` and `e2e/BACKLOG.md`.
- `eslint.config.mjs`, `.stylelintrc`, `.madgerc` — package-local tooling. The marktext-root ESLint explicitly ignores `packages/muya/**`, so muya self-lints with its own antfu-based config.

Stub packages (`packages/facade`, `packages/findReplace`) from the upstream muya monorepo were not migrated — they had no source.

## Commands

Run from the marktext repo root.

- `pnpm -C packages/muya/examples dev:demo` — start the examples Vite dev server. (Upstream `pnpm dev` / Turbo `dev:demo` is not wired here — run vite directly.)
- `pnpm -C packages/muya build` — `tsc && vite build`, emits `lib/{es,umd,cjs}` and `lib/types`.
- `pnpm -C packages/muya test` / `pnpm -C packages/muya coverage` — Vitest unit tests (co-located under `src/**/__tests__/`). Single file: `pnpm -C packages/muya exec vitest run path/to/file.test.ts`.
- `pnpm -C packages/muya test:spec` — CommonMark 0.31 + GFM 0.29-gfm fixture suites against `renderToStaticHTML(..., { sanitize: false })`. `test:spec:commonmark` / `test:spec:gfm` scope to one suite. Pass/fail counts are locked by `test/spec/expected-failures.json`: any listed example that starts passing fails the suite (remove it from the list); any unlisted example that starts failing fails the suite. Compliance can only go up. Baseline lives in `test/spec/conformance.md` (CommonMark 87.7% / GFM 86.3% at PR-6a).
- `pnpm -C packages/muya lint` / `pnpm -C packages/muya lint:fix` — ESLint over `src test` (antfu config; rules below).
- `pnpm -C packages/muya lint:types` — `tsc --noEmit`.
- `pnpm -C packages/muya lint:css` — Stylelint over `src/**/*.css`.
- `pnpm -C packages/muya check-circular` — `madge --circular src/index.ts`. CI enforces this.
- `pnpm -C packages/muya/e2e e2e` — Playwright E2E (chromium/firefox/webkit). `e2e:install` is a one-time browser install. CI (`muya-e2e.yml`) runs Chromium only; Firefox + WebKit are configured in `playwright.config.ts` and runnable locally, but excluded from the CI matrix until the engine-independent rewrites in BACKLOG Phase 3 land (triple-click selection, search-replace mutation timing).

Engines: Node ≥20.19 (matches marktext root). Build target is `chrome70`.

## Architecture

### Entry point and plugin system

`src/muya.ts` exports the `Muya` class. UI plugins are registered globally via the static `Muya.use(Plugin, options)` and instantiated inside `muya.init()`. Plugins are keyed by `Plugin.pluginName` and stored on `muya._uiPlugins`. The plugin set in `examples/src/main.ts` is the canonical reference for wiring up toolbars, selectors, and menus.

`new Muya(element, options)` replaces the passed-in element with a new `contenteditable` div (`getContainer` in `muya.ts`), then constructs `EventCenter`, `Editor`, `Ui`, and `I18n`. Nothing renders until `muya.init()` runs `Editor.init()`, which calls `registerBlocks()` and creates the root `ScrollPage`.

### The `Editor` (`src/editor/index.ts`)

Holds the runtime modules: `JSONState`, `InlineRenderer`, `Selection`, `Search`, `Clipboard`, `History`, and the root `ScrollPage`. It owns `activeContentBlock` (the focused leaf) and routes DOM events (`click`, `input`, `keydown`, `keyup`, `compositionstart/end`) merged via RxJS to the active block's handlers (`clickHandler`, `inputHandler`, etc.). Anything that listens to user input on a block ultimately flows through this dispatch.

`Editor.updateContents(operations, selection, source)` applies `ot-json1` operations to the live block tree. The `pick`/`drop` walk is hand-rolled from `ot-json1.apply` so it can call `block.replaceWith`, `container.insertBefore`, `ScrollPage.loadBlock(name).create(...)`, and `otText.type.apply` on the matching subdocument — the block tree and the JSON state stay in lockstep.

### Block tree

All blocks extend `TreeNode → Parent → (Content | Format)` in `src/block/base/`. `Parent` owns a `LinkedList` of `children` plus an `attachments` list for non-state nodes (icons, checkboxes). `Content` is the leaf that owns the actual text; `Format` extends `Content` with inline-format handling.

Concrete blocks live under `src/block/{commonMark,gfm,extra,content}` and **must be registered** in `src/block/index.ts::registerBlocks()`, which `Editor.init()` calls before constructing the root `ScrollPage`. `ScrollPage` (in `src/block/scrollPage/index.ts`) keeps a static `registeredBlocks` map; lookups go through `ScrollPage.loadBlock(blockName).create(muya, state)`. **Add a new block type → register it here, otherwise `loadBlock` will warn and return undefined.**

`block/mixins/{containerQueryBlock,leafQueryBlock}.ts` are constructor mixins applied to block classes for `queryBlock`/path resolution (the ROADMAP notes this was a deliberate switch away from property mixins).

### State and markdown round-trip (`src/state/`)

- `JSONState` (`state/index.ts`) is the source-of-truth document. It exposes `ot-json1` `invert`/`compose`/`transform` statics — the architecture is set up for OT-based collaborative editing even if no transport is wired in.
- `markdownToState.ts` parses Markdown (via `marked`) into the state tree; `stateToMarkdown.ts` serializes back; `markdownToHtml.ts` and `htmlToMarkdown.ts` (using `turndown` + `joplin-turndown-plugin-gfm`) bridge HTML. `MarkdownToHtml` is re-exported from the public API.
- Inline text edits are encoded as `ot-text-unicode` ops nested inside the json1 ops (see the `d.es` branch in `Editor.updateContents`).
- **Reference link/image definitions** (`[ref]: url "title"`) are NOT a first-class block type in state. `markdownToState`'s `case 'def'` re-emits the raw definition line back into a `paragraph` state node so it round-trips losslessly through the markdown serializer. `InlineRenderer.collectReferenceDefinitions()` runs over the live block tree on every render pass to populate a labels Map that the lexer consults when expanding `[text][ref]` and `![alt][ref]`. `ILinkReferenceDefinitionState` exists as a deprecated stub for compatibility — do not introduce new code paths that produce it.
- **TOC** is derived on-demand via `getTOC(muya)` (`state/getTOC.ts`); the public method is `muya.getTOC()` (`src/muya.ts`). Slugs follow the marktext-compatible regex carried over in commit `9cb2cbe8`.

### Inline rendering and DOM

`src/inlineRenderer/` tokenizes inline content with a custom `lexer`/`rules` pipeline and renders to a virtual DOM via `snabbdom` (and `snabbdom-to-html` for serialization). KaTeX, Prism, Mermaid, Vega/Vega-Lite, and PlantUML are integrated for math, code highlighting, and diagrams.

### UI layer (`src/ui/`)

Each subfolder is a floating tool/menu (inline format toolbar, image tools, paragraph front button, table tools, emoji selector, etc.) extending `baseFloat` or `baseScrollFloat` and positioned with `@floating-ui/dom`. They're imported and re-exported from `src/index.ts` and registered by consumers via `Muya.use(...)`. `Ui` (`src/ui/ui.ts`) is the registry the editor talks to.

### Public API surface

`src/index.ts` is the published entrypoint. The `exports` map in `package.json` points `.` at `./src/index.ts` during development and `./lib/es/index.js` after publish — keep this file the single export hub.

### Appearance contract (typography)

muya renders its own content's typography from two equivalent inputs — pass
options, or override the CSS custom properties directly (pure-CSS theming).
The variables are set on the editor root (`.mu-editor`) and consumed by the
bundled stylesheets; each has a default baked into the CSS, so passing nothing
renders the standalone defaults.

| Option (`IMuyaOptions`) | CSS variable | Default | Applies to |
|---|---|---|---|
| `fontSize` (number, px) | `--mu-font-size` | `16px` | `.mu-editor` base text |
| `lineHeight` (number) | `--mu-line-height` | `1.6` | `.mu-editor` base text |
| `editorFontFamily` (string) | `--mu-font-family` | Open Sans stack | `.mu-editor` base text |
| `codeFontSize` (number, px) | `--mu-code-font-size` | `90%` | `.mu-code-block` only |
| `codeFontFamily` (string) | `--mu-code-font-family` | DejaVu Sans Mono stack | `.mu-code-block` only |
| `wrapCodeBlocks` (boolean) | — (`.mu-code-wrap` root class) | off (`pre`) | code-block line wrapping |

Inline code (`code.mu-inline-rule`) is deliberately NOT driven by these — it
keeps its relative `0.8em` / mono sizing. Editor column width
(`--editor-area-width`) and the colour palette (`--editor-color-*`) are
separate, pre-existing contracts owned by the host. All runtime changes go
through `muya.setOptions({...})`.

## Conventions enforced by tooling

- **ESLint** (`eslint.config.mjs`, antfu base) adds:
    - `complexity` ≤ 20 and `max-lines-per-function` ≤ 200 (warnings) for non-test TS.
    - Interface names **must** start with `I[A-Z0-9]` (e.g. `IMuyaOptions`, `IPlugin`). The naming-convention rule will flag interfaces that don't.
    - Private class members **must** be prefixed with `_` (e.g. `_uiPlugins`, `_activeContentBlock`).
    - Style: 4-space indent, semicolons required, React rules disabled, Markdown linting disabled.
    - Bans `value as unknown as X` double-casts outside audited boundary helpers — use type guards or named helpers instead.
- **Madge** circular-dep check (`pnpm -C packages/muya check-circular`) runs in CI — adding a circular import will fail the build.
- Test files (`*.test.ts`, `*.spec.ts`) and `vite.config.ts` are excluded from the strict TS lint rules above.

Upstream muya had Conventional Commits + husky + lint-staged + release-it wired up. Those are **not** migrated into marktext — marktext does not use husky/commitlint, and `@muyajs/core` is not published from this repo. Commit style follows marktext's root contributing guide.

## Build pipeline notes

- **`vite-plugin-dts@5`** (transitive via `unplugin-dts`) uses `outDirs` (plural), not `outDir`. `vite.config.ts` relies on this to emit declarations into `lib/types/`, which is the path `package.json`'s `publishConfig.exports[*].types` points to. If you ever see `lib/index.d.ts` appearing directly under `lib/`, the option name has regressed.
- `@laynezh/vite-plugin-lib-assets` routes `*.png` to `lib/assets/icons/` and font files to `lib/assets/fonts/`.
