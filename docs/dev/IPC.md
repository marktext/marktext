# Inter-Process Communication (IPC)

The renderer runs sandboxed (`contextIsolation: true`, `sandbox: true`,
`nodeIntegration: false` — see `src/main/config.ts`), so it can't import
`electron` directly. All renderer↔main traffic goes through the typed
preload bridge exposed in `src/preload/index.ts` as `window.electron.*`
and a few sibling globals (`window.fileUtils`, `window.path`,
`window.uploader`, etc.).

Channel names are typed by the contract in `src/shared/types/ipc.ts` —
wrong channel, wrong arg arity, or wrong return shape all fail at
`pnpm typecheck`. See [TYPESCRIPT.md](TYPESCRIPT.md#ipc-contract) for the
TypeScript-side details.

## Channel naming

Renderer↔main channels are prefixed with `mt::` (e.g. `mt::fs::stat`,
`mt::open-new-tab`). A small number of legacy internal channels don't
follow this convention (e.g. `language-changed`); new channels should
always use `mt::`.

## The four channel categories

`src/shared/types/ipc.ts` defines four interfaces:

| Interface              | Direction          | Semantics                                  |
| ---------------------- | ------------------ | ------------------------------------------ |
| `IpcInvokeChannels`    | renderer → main    | `Promise<T>` round-trip (`ipcMain.handle`) |
| `IpcSendChannels`      | renderer → main    | fire-and-forget (`ipcMain.on`)             |
| `IpcSyncChannels`      | renderer → main    | synchronous reply (`event.returnValue`)    |
| `IpcMainEventChannels` | main → renderer    | push event (`webContents.send` / on)       |

Each entry tells you the args tuple and (for invoke/sync) the return
type:

```ts
'mt::fs::stat': { args: [path: string]; ret: SerializedStat }
'mt::format-link-click': [payload: { data: unknown; dirname: string }]   // send shape
```

## Renderer side

Use the global `window.electron.ipcRenderer` (the typed wrapper exposed
by the preload bridge). Don't `import { ipcRenderer } from 'electron'` —
it isn't available under sandboxing.

```ts
// Round-trip
const stat = await window.electron.ipcRenderer.invoke('mt::fs::stat', fullPath)

// Fire-and-forget
window.electron.ipcRenderer.send('mt::format-link-click', { data, dirname })

// Subscribe to a main → renderer push event (returns an unsubscribe fn)
const off = window.electron.ipcRenderer.on('mt::screenshot-captured', () => {
  // …
})
off()
```

`once()` and `removeAllListeners()` follow the same shape. For
filesystem and path helpers, prefer the typed convenience APIs already
exposed via `window.fileUtils.*`, `window.path.*`, `window.uploader.*`,
etc. — they wrap the underlying `mt::fs::*` / `mt::uploader::*` channels
and keep call sites short.

## Main side

Channels are wired with `ipcMain.handle` (invoke), `ipcMain.on` (send /
sync), or `webContents.send` (push):

```ts
import { ipcMain } from 'electron'

ipcMain.handle('mt::fs::stat', async (_event, path: string) => {
  return await fs.stat(path)
})

ipcMain.on('mt::format-link-click', (_event, { data, dirname }) => {
  // …
})

// Push to a specific renderer window:
window.webContents.send('mt::open-new-tab', tabPayload, options, selected)
```

## Adding a new channel

1. Add an entry to the appropriate interface in
   `src/shared/types/ipc.ts` (pick invoke / send / sync / main-event
   based on the direction and shape).
2. Wire the main-process handler in `src/main/ipc/*.ts` (or the relevant
   feature module).
3. Call it from the renderer through `window.electron.ipcRenderer.*` or,
   if it deserves a dedicated facade, expose a method on one of the
   typed bridges in `src/preload/index.ts`.

After step 1, `pnpm typecheck` flags every existing call site that
doesn't match the new shape — use that as your migration checklist.
