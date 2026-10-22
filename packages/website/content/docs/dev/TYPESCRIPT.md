# TypeScript

The desktop application uses strict TypeScript with Vue single-file components. Paths beginning with `src/` in this guide are relative to `packages/desktop/`. Muya and the website have separate TypeScript configurations.

## tsconfig layout

The desktop's `tsconfig.json` extends `tsconfig.base.json` without project references. It includes desktop TypeScript/Vue files, tests, and the electron-vite, Vitest and Playwright configuration files. Root installation and maintenance scripts live in the repository-root `scripts/` directory.

Relevant settings in `tsconfig.base.json`:

- `strict: true`
- `noUncheckedIndexedAccess: false`
- `exactOptionalPropertyTypes: false`
- `allowJs: false` and `checkJs: false`
- `noEmit: true`

`vue-tsc` checks types; electron-vite bundles the application. `allowJs: false` excludes JavaScript from this TypeScript program; it does not mean that every repository asset is TypeScript.

## Path aliases

The desktop build configuration defines these aliases:

| Alias       | Maps to              |
| ----------- | -------------------- |
| `@/*`       | `src/renderer/src/*` |
| `common/*`  | `src/common/*`       |
| `@shared/*` | `src/shared/*`       |

`main_renderer/*` maps to `src/main/*` in the TypeScript and Vitest configurations. The renderer build also maps the bare `path` import to `src/renderer/src/node/platformPath.ts`.

TypeScript redirects `@muyajs/core` and `@muyajs/core/*` to generated declarations under `../muya/lib/types/`. Without that redirect, the package's source `exports` would bring Muya into the desktop TypeScript program. `pnpm typecheck` and the root postinstall script generate those declarations with `pnpm --filter @muyajs/core build:types`.

Runtime builds and Vitest resolve Muya through its package `exports` map. Keep TypeScript, electron-vite and Vitest resolution consistent when changing aliases.

## Where types live

- `src/shared/types/`: shared document, IPC, preference, menu and event types, plus the `TypedEmitter` helper. Import these through `@shared/types/*`.
- `src/types/`: ambient declarations, including the renderer's global bridge types.
- Feature modules: types specific to a single feature can be defined next to its implementation.

## IPC contract

`src/shared/types/ipc.ts` defines four channel maps:

| Map                    | Direction and behavior                                  |
| ---------------------- | ------------------------------------------------------- |
| `IpcInvokeChannels`    | Renderer to main; argument tuple and Promise result     |
| `IpcSendChannels`      | Renderer to main; fire-and-forget argument tuple        |
| `IpcSyncChannels`      | Renderer to main; synchronous argument tuple and result |
| `IpcMainEventChannels` | Main to renderer; event argument tuple                  |

The preload wrapper exposes typed renderer calls:

```ts
const stat = await window.electron.ipcRenderer.invoke('mt::fs::stat', fullPath)
```

Channel names, call arguments and the caller's result type follow the contract. Electron's main-process `ipcMain.handle` and `webContents.send` calls are not automatically checked against these maps. Handler implementations must also return the declared serializable shape; adding explicit shared return types helps check that boundary.

See [IPC](IPC.md) for bridge subscriptions and the steps to add a channel.

## TypedEmitter

Main-process window classes use `TypedEmitter` from `@shared/types/typedEmitter`. For example, `src/main/windows/base.ts` defines these `BaseWindowEvents` entries:

```ts
interface BaseWindowEvents {
  'window-ready': []
  'window-focus': []
  'window-blur': []
  'window-close': []
  'window-closed': []
}
```

The event map checks event names and listener arguments on the typed emitter.

## Pinia stores

Stores live in `src/renderer/src/store/`. `editor.ts` and `preferences.ts` use Options Stores; the other store definitions use Setup Stores. The editor store represents the absence of an active file as `null`, so consumers must narrow `currentFile` before accessing its document fields.

## Strict-mode conventions

Initialize class fields before use, narrow caught errors from `unknown`, and use library types where available. TypeScript can infer callback parameters from typed collections; add annotations where inference lacks enough context.

`@typescript-eslint/no-explicit-any` is an error in desktop TypeScript and Vue files. Keep necessary suppressions local and explain which missing type information requires them.

## Type-checking

```sh
pnpm typecheck
pnpm typecheck:watch
pnpm check
```

`typecheck` generates Muya declarations and runs `vue-tsc --noEmit -p tsconfig.json`. `check` runs root lint followed by that type check. Desktop lint CI runs both lint and type checking in `.github/workflows/lint.yml`.
