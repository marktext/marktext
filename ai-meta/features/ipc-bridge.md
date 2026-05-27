# Feature: IPC Bridge Contract

> Feature ID: F03 | Safety Level: **HIGH RISK** | Process: preload + main

---

## Scope

The IPC bridge is the only communication channel between the sandboxed renderer process and the
main process. Any change to this system affects all renderer↔main interactions simultaneously.

**Single source of truth**: `src/shared/types/ipc.ts`
**Bridge implementation**: `src/preload/index.ts`
**Handler registration**: `src/main/ipc/index.ts`

---

## Architecture

```
Renderer (Vue 3)
  → window.electron.invoke('mt::channel', ...args)    [Promise<T>]
  → window.electron.send('mt::channel', ...args)       [void]
  → window.electron.on('mt::channel', listener)        [unsubscribe fn]

window.electron (defined in preload via contextBridge)
  → ipcRenderer.invoke / ipcRenderer.send / ipcRenderer.on

Main process ipcMain.handle / ipcMain.on
  → handlers in src/main/ipc/
  → optionally: webContents.send() back to renderer
```

---

## Channel Categories

| Interface | Direction | Mechanism |
|-----------|-----------|-----------|
| `IpcInvokeChannels` | renderer → main | `ipcRenderer.invoke` → `Promise<T>` |
| `IpcSendChannels` | renderer → main | `ipcRenderer.send` → fire-and-forget |
| `IpcSyncChannels` | renderer → main | `ipcRenderer.sendSync` → synchronous |
| `IpcMainEventChannels` | main → renderer | `webContents.send` → renderer `.on()` |

---

## Boot Sequence IPC

The only synchronous IPC call is `mt::boot-info` — fired before Vue mounts:
```ts
// preload/index.ts
const bootInfo = ipcRenderer.sendSync('mt::boot-info') as BootInfo | undefined
```
This populates `window.marktext.bootInfo` with paths, env, versions, initial preferences,
and keyboard layout info before any Vue reactive code runs.

---

## Key IPC Channels (from src/shared/types/ipc.ts — partial)

### Invoke (renderer → main, async)
- `mt::boot-info-async` — async variant of boot info
- `mt::fs::read-file`, `mt::fs::write-file`, `mt::fs::stat`, etc. — file operations
- `mt::fonts::list` — system font enumeration
- `mt::spellchecker-get-available-dictionaries` — spell check
- `mt::rg::start` — ripgrep full-text search
- `mt::win::is-fullscreen`, `mt::win::is-maximized` — window state
- `update-buffer-state` — editor buffer snapshot to main (crash recovery)

### Send (renderer → main, fire-and-forget)
- `app-create-editor-window` — open new editor window
- `app-open-file-by-id` — open file in specific window
- `broadcast-preferences-changed` — notify all windows of pref change
- `mt::shell::show-item` — show file in OS file manager

---

## Risks

| Risk | Severity | Details |
|------|----------|---------|
| Removing a channel without updating all callers | CRITICAL | `.js` files in muya/renderer won't produce TypeScript errors |
| Adding a channel without preload exposure | HIGH | Renderer invoke call silently returns undefined |
| sendSync misuse | HIGH | Blocks UI thread; only `mt::boot-info` is justified |
| Type widening (args: unknown[]) | MEDIUM | Some channels still use `unknown[]` during migration; tighten carefully |

---

## Change Rules

1. **Adding a channel**: Add to the correct interface in `ipc.ts` → register handler in `src/main/ipc/` → expose in preload.
2. **Removing a channel**: Must audit all call sites (grep for channel string) before removal.
3. **Renaming a channel**: Treat as remove + add; update all three touch points atomically.
4. **Channel naming**: All new channels must use `mt::` prefix.
5. **No new `sendSync` channels**: The synchronous pattern is reserved for `mt::boot-info` only.

---

## Related Features

- F04: Preferences System (uses `broadcast-preferences-changed`)
- F05: File System (uses `mt::fs::*` channels)
- F08: Spell Checker (uses `mt::spellchecker-*` channels)
- F10: Search (uses `mt::rg::start`)
- F16: Auto-Save / Buffer Recovery (uses `update-buffer-state`)
