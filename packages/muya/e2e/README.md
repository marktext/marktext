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

The host page is independent of `examples/`, so demo changes do not alter the test harness.

## Running locally

From the repo root:

```sh
pnpm install                    # one-time, picks up @playwright/test
pnpm --filter muya-e2e e2e       # full matrix — Chromium + Firefox + WebKit
pnpm --filter muya-e2e e2e:ui    # Playwright UI mode (recommended for debugging)
pnpm --filter muya-e2e e2e:headed # full matrix with visible browser windows
```

Targeted runs:

```sh
pnpm --filter muya-e2e e2e:chromium   # Chromium only (system Chrome locally)
pnpm --filter muya-e2e e2e:firefox    # Firefox only (bundled binary)
pnpm --filter muya-e2e e2e:webkit     # WebKit only (bundled binary)
```

CI (`.github/workflows/muya-e2e.yml`) installs and runs **Chromium only**.
Firefox and WebKit are configured for local runs, with engine-specific exclusions
in `playwright.config.ts`; they are not part of the current CI matrix.

Locally the Chromium project uses system Chrome by default. Firefox and WebKit
require Playwright's browser downloads:

```sh
pnpm --filter muya-e2e exec playwright install firefox webkit
# Install all three browsers, including system dependencies:
pnpm --filter muya-e2e e2e:install
```

To force bundled Chromium locally:

```sh
PLAYWRIGHT_USE_BUNDLED_CHROMIUM=1 pnpm --filter muya-e2e e2e:chromium
```

Inspect failures:

```sh
pnpm --filter muya-e2e e2e:chromium --reporter=html
pnpm --filter muya-e2e e2e:report   # Open the generated HTML report
```

## Conventions

- **`page.keyboard.type` with `delay: 0` drops characters.** rapid synthetic input can outrun editor updates. Use `slowType()` from `tests/helpers/keyboard.ts` (30ms per char) for any typing > 4 chars.
- **Float plugins hide via `opacity: 0`, not `display: none`.** `expect(...).toBeHidden()` won't work — assert on computed opacity or rely on a subsequent action to settle state.
- **DOM edits can be pending until the next frame.** Call `window.muya!.flush()` inside `page.evaluate` before reading `getMarkdown()` or `getState()` for an assertion.
- **No `(window as any).muya`.** `types.d.ts` declares `Window.muya?: Muya`; the project bans `any` (`ts/no-explicit-any: 'error'`), so explicit casts will fail lint.
- **One global E2E sandbox per workspace.** The host pre-registers every UI plugin. Specs that want a clean slate call `window.muya!.setContent('')` in a `before*` or first step.

## Adding a new spec

1. Pick a folder by category (`tests/<category>/your-feature.spec.ts`).
2. `import { test, expect } from '../fixtures/muya'` — gives you a Page with `window.muya` already initialised.
3. Use selectors from `tests/helpers/selectors.ts` (or extend it). Don't hard-code `.mu-*` classes inside spec files.
4. Bias toward asserting via the public API (`getMarkdown` / `getState` / `getTOC`) over DOM regex matching — markdown serialization is deterministic where snabbdom output can shift.

## Coverage limits

- Firefox and WebKit exclude the inline toolbar, keyboard shortcut and
  search/replace suites listed in `playwright.config.ts`. Their selection and
  search drivers need browser-independent coverage before those exclusions can
  be removed and CI expanded beyond Chromium.
- Native clipboard tests require Chromium permissions and are skipped on
  Firefox/WebKit. Synthetic IME tests also have WebKit exclusions; see the skip
  reasons beside each test.
- Accessibility scans fail on `critical` violations and log lower-severity
  findings. The host toolbar (`.tools`) is excluded from scans.
- The performance smoke test uses the Vite development server and allows up to
  60 seconds for 10,000-paragraph `setContent`. This is a regression threshold;
  production performance needs separate measurement.
- This workspace has no dedicated E2E type-check script.

List the current tests with
`pnpm --filter muya-e2e exec playwright test --list`.
