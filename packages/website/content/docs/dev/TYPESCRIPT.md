# TypeScript

MarkText is a TypeScript project. Every file under `src/`, the build
scripts under `scripts/`, the test specs under `test/`, the build config
(`electron.vite.config.ts`), and the test configs (`vitest.config.ts`,
`playwright.config.ts`) are TS.

So is the editor engine: `@muyajs/core` (`packages/muya`). The legacy
JavaScript engine it replaced is no longer reachable from here — its
`muya/*` alias and the `src/types/muya.d.ts` ambient bridge were removed
once nothing imported them (#4257).

## tsconfig layout

Single root project, no `composite`/`references`:

```
tsconfig.base.json     # shared compiler options (strict, paths, libs)
tsconfig.json          # extends base, adds lib/types/jsx + include/exclude
```

Why a single project: nothing under `src/` needs declaration emission
(the bundler is electron-vite), and the renderer, preload and main
processes share enough types that splitting them into project
references would mostly add ceremony. A single `--noEmit` project keeps
the wiring minimal without giving up strict mode.

Relevant settings (`tsconfig.base.json`):

- `strict: true` (every strict flag on)
- `noUncheckedIndexedAccess: false` — too disruptive given existing
  index-access patterns (tabs, listToc)
- `exactOptionalPropertyTypes: false` — kept off to keep the buffered-state
  restore path (which carries optional fields through JSON serialization)
  tolerant of `undefined` ≡ "key not present"
- `allowJs: false, checkJs: false` — every directory under `src/` is
  now `.ts` except `src/muya/`, which the rest of the tree reaches
  through the ambient declarations in `src/types/muya.d.ts`
- `noEmit: true` — vue-tsc only type-checks; electron-vite handles the
  actual bundling

## Path aliases

Defined in both `tsconfig.base.json` and `electron.vite.config.ts` (the
two must stay in sync):

| Alias       | Maps to               |
| ----------- | --------------------- |
| `@/*`       | `src/renderer/src/*`  |
| `common/*`  | `src/common/*`        |
| `@shared/*` | `src/shared/*`        |

`vitest.config.ts` carries the same aliases plus `main_renderer` →
`src/main` for the few unit specs that reach into main-process code.

`tsconfig.base.json` carries one more entry that is a type-resolution
redirect rather than a module alias: `@muyajs/core` →
`../muya/lib/types/index.d.ts`. The package's `exports` map points `.` at
its TypeScript source, so without the redirect vue-tsc would pull the whole
muya tree into the desktop's program under the desktop's compiler options.
`pnpm typecheck` and `postinstall` both run `pnpm --filter @muyajs/core
build:types` to produce that directory (it is ignored build output).
electron-vite and Vitest are unaffected — they resolve the runtime module
through the `exports` map.

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
  ): Promise<IpcInvokeChannels[K]['ret']> => ipcRenderer.invoke(channel, ...args)
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

The engine is consumed as `@muyajs/core` and typed from its own emitted
declarations — see the type-resolution note under "Path aliases" above.
There is no hand-written shim in between any more.

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

All four items from the original deferred-work list landed across
PRs #4249–#4255:

- editor.ts + preferences.ts Pinia stores (#4249)
- prefComponents schemas + leaf SFC controls (#4250)
- Test specs ESM + strict TS (#4251)
- Sidebar + top-level page SFCs (#4252)
- Editor + components SFCs (#4253)
- Preference page SFCs (#4254)
- `@typescript-eslint/no-explicit-any` flipped from `warn` to `error` (#4255)

A handful of targeted `eslint-disable-next-line` directives remain, each
with its own justification — most of them in the CodeMirror 5 mode
plumbing under `src/renderer/src/codeMirror/`, whose `@types/codemirror`
surface does not describe the mode API.

The rule covers `.vue` files as well, and no SFC needs an exemption: the
CodeMirror handles in `sourceCode.vue` use `@types/codemirror` and the
editor handle in `editor.vue` is a `shallowRef<Muya | null>` typed from
the engine's own declarations (#4257).

## Type-checking

```bash
pnpm typecheck            # vue-tsc --noEmit -p tsconfig.json
pnpm typecheck:watch      # incremental
pnpm check                # lint + typecheck
```

`vue-tsc` is the TS compiler with Vue SFC awareness. Plain `tsc` won't
type-check `.vue` files. CI runs `pnpm typecheck` as part of the lint
job (see `.github/workflows/lint.yml`).
