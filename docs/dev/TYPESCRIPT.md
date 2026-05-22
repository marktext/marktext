# TypeScript

MarkText is a TypeScript project. Every file under `src/` (except `src/muya/`),
the build scripts under `scripts/`, the test specs under `test/`, the
build config (`electron.vite.config.ts`), and the test configs
(`vitest.config.ts`, `test/e2e/playwright.config.ts`) are TS.

The only JavaScript that ships in the source tree is `src/muya/` — the
legacy editor engine, which will be replaced by the upstream TS muya at
https://github.com/marktext/muya. The migration's `src/types/muya.d.ts`
ambient declaration is the bridge; consumers always go through that file,
never the underlying `src/muya/lib/*.js`.

## tsconfig layout

Single root project, no `composite`/`references`:

```
tsconfig.base.json     # shared compiler options (strict, paths, libs)
tsconfig.json          # extends base, adds lib/types/jsx + include/exclude
```

Why a single project: `composite: true` requires declaration emission,
which fails on `allowJs` files that transitively reach into `src/muya/`
types pulled from `@types/trusted-types`. A single `--noEmit` project
sidesteps the issue without giving up strict mode.

Relevant settings (`tsconfig.base.json`):

- `strict: true` (every strict flag on)
- `noUncheckedIndexedAccess: false` — too disruptive given existing
  index-access patterns (tabs, listToc)
- `exactOptionalPropertyTypes: false` — kept off to keep the buffered-state
  restore path (which carries optional fields through JSON serialization)
  tolerant of `undefined` ≡ "key not present"
- `allowJs: true, checkJs: false` — for `src/muya/` only (every other
  directory is now `.ts`)
- `noEmit: true` — vue-tsc only type-checks; electron-vite handles the
  actual bundling

## Path aliases

Defined in both `tsconfig.base.json` and `electron.vite.config.ts` (the
two must stay in sync):

| Alias       | Maps to                |
|-------------|------------------------|
| `@/*`       | `src/renderer/src/*`   |
| `common/*`  | `src/common/*`         |
| `muya/*`    | `src/muya/*` (legacy)  |
| `@shared/*` | `src/shared/*`         |

`vitest.config.ts` carries the same aliases plus `main_renderer` →
`src/main` for the few unit specs that reach into main-process code.

## Where types live

- **`src/shared/types/`** — cross-process types (IPC contract, file/tab
  shapes, preferences, menu, bus, TypedEmitter helper). Pure type
  artefacts, no runtime. Importable from any process via `@shared/types/*`.
- **`src/types/`** — ambient declarations (`global.d.ts`, `renderer.d.ts`,
  `muya.d.ts`, `shims.d.ts`). `.d.ts` only; no runtime.
- **Co-located** — domain types specific to one feature live next to the
  code (e.g. `src/main/ipc/ripgrep.ts` defines its own `SearchOptions`).

## IPC contract

The single source of truth is `src/shared/types/ipc.ts`. Four channel maps:

- `IpcInvokeChannels` — renderer → main, returns Promise<T>
- `IpcSendChannels` — renderer → main, fire-and-forget
- `IpcSyncChannels` — synchronous renderer → main
- `IpcMainEventChannels` — main → renderer push events

The preload bridge (`src/preload/index.ts`) consumes these as generics:

```ts
const ipcWrapper = {
  send: <K extends keyof IpcSendChannels>(channel: K, ...args: IpcSendChannels[K]) =>
    ipcRenderer.send(channel, ...args),
  invoke: <K extends keyof IpcInvokeChannels>(
    channel: K,
    ...args: IpcInvokeChannels[K]['args']
  ): Promise<IpcInvokeChannels[K]['ret']> =>
    ipcRenderer.invoke(channel, ...args),
  // ...
}
```

Every renderer-side `window.electron.ipcRenderer.invoke('mt::fs::stat', p)`
call is type-checked: wrong channel name, wrong arg arity, wrong arg
types, all surface at compile time.

To add a new channel:
1. Add an entry to the appropriate interface in `src/shared/types/ipc.ts`.
2. Wire the handler in `src/main/ipc/*.ts` via `ipcMain.handle`/`ipcMain.on`.
3. Use it from the renderer via `window.electron.ipcRenderer.{invoke,send,…}`.

## muya boundary

`src/muya/` stays JavaScript. The `src/types/muya.d.ts` ambient
declaration covers the ~21 import paths the rest of the codebase
actually uses (`muya/lib/utils`, `muya/lib/utils/dompurify`,
`muya/lib/parser/marked/slugger`, the dozen-plus `muya/lib/ui/*` overlay
components, etc.). Most entries are `any`-typed shims — good enough for
the consumer side, and they delete cleanly the day upstream TS muya
lands.

## TypedEmitter

Main-process classes that historically extended `node:events#EventEmitter`
now extend `TypedEmitter<EventMap>` from `@shared/types/typedEmitter`.
Event names + listener-argument tuples are typed:

```ts
interface BaseWindowEvents {
  'window-ready': []
  'window-blur': []
  'will-close': [id: number, opts: { keepInBackground: boolean }]
}

class BaseWindow extends TypedEmitter<BaseWindowEvents> { ... }
```

Wrong event names or mismatched listener arities fail at compile time.

## Pinia stores

All 9 active Pinia stores (`src/renderer/src/store/`) are typed. Seven are
Setup Stores (`defineStore('id', () => { ... return { ...refs, ...computeds,
...actions } })`); `editor.ts` and `preferences.ts` remain Options Stores
because Pinia's Options-Store typing is fully inferrable from a typed
`state: () => State` factory, and converting their ~80 cross-store call
sites buys no expressiveness over a typed Options Store.

The editor store's `currentFile` sentinel is now `IFileState | null`
instead of the legacy empty-object placeholder, and consumers do explicit
null narrowing where they previously checked `!currentFile.id`.

## Strict-mode landmines

- **`strictPropertyInitialization`** — class fields must be initialized
  in the constructor or marked with `!:` (definite-assignment assertion).
  Prefer initialization; reach for `!:` only where the runtime guarantees
  the field is set before any access.
- **`useUnknownInCatchVariables`** — `catch (err)` gives `err: unknown`.
  Narrow before using: `err instanceof Error ? err.message : String(err)`.
- **`noImplicitAny`** — every callback parameter needs a type. For
  iterators (`tabs.find(t => ...)`), TS infers from the element type.
- **Event handler unions** — Electron's `BrowserWindow.on` is heavily
  overloaded; passing a union of event names (`'maximize'|'unmaximize'|...`)
  can require a cast through `any`.

## Deferred work

These items are tracked as follow-up PRs:

1. **All `.vue` SFCs** — remove `// @ts-nocheck` from `<script setup
   lang="ts">` blocks, type `defineProps`/`defineEmits`, fix
   ~20 errors per file.
2. **Test specs** — remove `// @ts-nocheck` from `test/unit/specs/*.spec.ts`
   and `test/e2e/*.spec.ts`, convert CommonJS `require()` to ESM `import`.
3. **`@typescript-eslint/no-explicit-any`** — currently `warn` in
   `eslint.config.js`. Tighten to `error` after the per-file
   `// @ts-nocheck` opt-outs above have been removed and the remaining
   `any` sites either gain a real type or carry a targeted
   `// eslint-disable-next-line` with a comment explaining why.

## Type-checking

```bash
pnpm typecheck            # vue-tsc --noEmit -p tsconfig.json
pnpm typecheck:watch      # incremental
pnpm check                # lint + typecheck
```

`vue-tsc` is the TS compiler with Vue SFC awareness. Plain `tsc` won't
type-check `.vue` files. CI runs `pnpm typecheck` as part of the lint
job (see `.github/workflows/lint.yml`).
