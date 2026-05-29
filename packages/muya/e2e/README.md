# `muya-e2e`

Playwright end-to-end test suite for `@muyajs/core`. Real-browser tests that exercise muya's contenteditable surface, floating UI plugins, KaTeX / Mermaid rendering, and public API — the things `happy-dom` unit tests can't cover.

## Layout

```
e2e/
├── host/              # Minimal SUT (system-under-test) page
│   ├── index.html     # #editor + toolbar buttons (#undo, #search, …)
│   └── main.ts        # Registers all UI plugins, exposes window.muya
├── vite.config.ts     # Vite dev server, port 5174 (avoids examples 5173)
├── playwright.config.ts
├── types.d.ts         # Augments Window.muya?: Muya for evaluate callbacks
└── tests/
    ├── fixtures/      # Auto-wait-for-muya-init fixture
    ├── helpers/       # selectors / keyboard / api wrappers
    ├── smoke/         # P0 boot + public API
    ├── typing/        # block creation via typing/slash menu
    ├── inline/        # IFT, emoji, links, shortcuts
    ├── ui/            # slash menu, paragraph-front, image, footnote
    ├── editing/       # undo/redo, selection, search/replace, clipboard
    └── i18n/          # locale switching
```

The host page is intentionally decoupled from `examples/` — that folder is undergoing a parallel refactor, and a self-owned SUT keeps the two workstreams independent.

## Running locally

From the repo root:

```sh
pnpm install                    # one-time, picks up @playwright/test
pnpm e2e                        # full matrix — Chromium + Firefox + WebKit
pnpm e2e:ui                     # Playwright UI mode (recommended for debugging)
pnpm e2e:headed                 # headed Chrome with normal page UI
```

Targeted runs (Phase 2 added the cross-browser matrix):

```sh
pnpm --filter muya-e2e e2e:chromium   # Chromium only (system Chrome locally)
pnpm --filter muya-e2e e2e:firefox    # Firefox only (bundled binary)
pnpm --filter muya-e2e e2e:webkit     # WebKit only (bundled binary)
```

On CI (`CI=1`), Playwright uses the bundled Chromium / Firefox / WebKit downloaded by the `playwright install --with-deps chromium firefox webkit` step in `ci-e2e.yml`. Locally, the Chromium project falls back to the OS-installed Chrome so you don't need the 170 MB Chromium-for-Testing download; Firefox and WebKit have no system equivalent, so you must download them once:

```sh
pnpm --filter muya-e2e exec playwright install firefox webkit
# or, to install all three at once:
pnpm e2e:install
```

To force bundled Chromium locally:

```sh
PLAYWRIGHT_USE_BUNDLED_CHROMIUM=1 pnpm e2e
```

Inspect failures:

```sh
pnpm --filter muya-e2e exec playwright show-report   # HTML report from the latest run
```

## Conventions

- **`page.keyboard.type` with `delay: 0` drops characters.** muya's content-change pipeline re-renders synchronously per keystroke; Playwright's default 0ms inter-key delay can outrun snabbdom patches. Use `slowType()` from `tests/helpers/keyboard.ts` (30ms per char) for any typing > 4 chars.
- **Float plugins hide via `opacity: 0`, not `display: none`.** `expect(...).toBeHidden()` won't work — assert on computed opacity or rely on a subsequent action to settle state.
- **`getMarkdown()` reads state asynchronously after the last keystroke.** Use `expect(domNode).toContainText(...)` as a sync barrier before reading markdown.
- **No `(window as any).muya`.** `types.d.ts` declares `Window.muya?: Muya`; the project bans `any` (`ts/no-explicit-any: 'error'`), so explicit casts will fail lint.
- **One global E2E sandbox per workspace.** The host pre-registers every UI plugin. Specs that want a clean slate call `window.muya!.setContent('')` in a `before*` or first step.

## Adding a new spec

1. Pick a folder by category (`tests/<category>/your-feature.spec.ts`).
2. `import { test, expect } from '../fixtures/muya'` — gives you a Page with `window.muya` already initialised.
3. Use selectors from `tests/helpers/selectors.ts` (or extend it). Don't hard-code `.mu-*` classes inside spec files.
4. Bias toward asserting via the public API (`getMarkdown` / `getState` / `getTOC`) over DOM regex matching — markdown serialization is deterministic where snabbdom output can shift.

## Roadmap

This is **Phase 1 — P0 smoke + key interaction skeleton**. See [BACKLOG.md](./BACKLOG.md) for the full 4-phase plan.
