# Architecture Overview — MarkText

> Authoritative runtime structure based on code analysis of `src/`.
> Evidence paths are provided for every claim.

---

## 1. Three-Process Electron Model

```
┌──────────────────────────────────────────────────────────────────────┐
│  MAIN PROCESS  (src/main/)                                           │
│  • Node.js full access + Electron APIs                               │
│  • Entry: src/main/index.ts                                          │
│  • Singleton: one per application launch                             │
│  • Manages: windows, file I/O, spell check, IPC handlers,            │
│             preferences, keyboard shortcuts, menus, auto-updater     │
│  • Accessor pattern: src/main/app/accessor.ts aggregates all         │
│    subsystems (Preference, DataCenter, EditorBufferStore,            │
│    CommandManager, Keybindings, AppMenu, WindowManager)              │
├──────────────────────────────────────────────────────────────────────┤
│  PRELOAD  (src/preload/index.ts)                                      │
│  • Bridge between main and renderer                                  │
│  • Compiled to CommonJS                                              │
│  • Exposes typed API surface via contextBridge:                      │
│      window.electron   (IPC invoke/send/on/once)                     │
│      window.fileUtils  (file I/O delegates)                          │
│      window.path       (pathe path utilities)                        │
│      window.webUtils   (file URL helpers)                            │
│      window.shell      (openExternal, openPath)                      │
│      window.clipboard  (read/write/guessFilePath)                    │
│      window.i18n       (load, isSupportedLanguage, supportedLanguages│
│      window.marktext   (bootInfo, env, paths, versions)              │
├──────────────────────────────────────────────────────────────────────┤
│  RENDERER  (src/renderer/)                                           │
│  • One process per editor window                                     │
│  • Vue 3 + Pinia + Vue Router 4 + Element Plus                       │
│  • Entry: src/renderer/src/main.ts                                   │
│  • Bootstrap: src/renderer/src/bootstrap.ts                          │
│  • Sandboxed: contextIsolation: true, nodeIntegration: false         │
│    (Note: editor + settings windows use contextIsolation: false +    │
│     nodeIntegration: true — see src/main/config.ts)                  │
│  • Window type routing: src/renderer/src/router/                     │
│  • Hosts Muya (WYSIWYG) and CodeMirror (source-code mode)            │
├──────────────────────────────────────────────────────────────────────┤
│  MUYA  (src/muya/)                                                    │
│  • Self-contained editor backend (JavaScript, not TypeScript)        │
│  • No Electron API dependencies (exception: plantuml.js uses zlib)   │
│  • Entry class: Muya (src/muya/lib/index.js)                         │
│  • Plugin system: Muya.use(Plugin, options) static registration       │
│  • Core: ContentState + 25 mixin controllers                          │
│  • Parser: custom tokenizer + forked marked                           │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. IPC Contract

**Single source of truth**: `src/shared/types/ipc.ts`

Four categories of channels:

| Interface | Direction | Mechanism | Pattern |
|-----------|-----------|-----------|---------|
| `IpcInvokeChannels` | renderer → main | `ipcRenderer.invoke` | `Promise<T>` return |
| `IpcSendChannels` | renderer → main | `ipcRenderer.send` | fire-and-forget |
| `IpcSyncChannels` | renderer → main | `ipcRenderer.sendSync` | synchronous (avoid) |
| `IpcMainEventChannels` | main → renderer | `webContents.send` | push events |

Channel naming convention: `mt::` prefix for all application channels.
Exception: `language-changed`, `update-buffer-state` (pre-convention channels).

**Boot sequence**: renderer calls synchronous `mt::boot-info` at startup (before Vue mounts)
to receive `BootInfo` (paths, env, versions, preferences, keyboard layout) without an async await.

---

## 3. Data Flow: Opening a File

```
CLI / menu / IPC → App._openFilesCache (main)
  → WindowManager.openDocuments()
  → EditorWindow.openDocumentInNewTab() [IPC: app-open-file-by-id]
  → renderer: useEditorStore().ADD_NEW_FILE_IN_EDITOR()
  → Muya.setMarkdown()
  → ContentState._parse() → StateRender.render()
  → DOM
```

---

## 4. Data Flow: Saving a File

```
Renderer: editorStore.SAVE_CURRENT_FILE()
  → ipc.invoke('mt::fs::write-file', path, content)
  → preload → ipcMain handler (src/main/ipc/fs.ts)
  → Node.js fs.writeFile()
  → ipc push event: 'mt::file-saved' → renderer notified
```

---

## 5. Data Flow: Content Edit (Keystroke → State)

```
DOM keydown event → Muya Keyboard handler (src/muya/lib/eventHandler/keyboard.js)
  → ContentState mixin (e.g. inputCtrl.js, formatCtrl.js)
  → block.text mutation
  → ContentState.partialRender()
  → StateRender.renderBlock()
  → DOM patch (innerHTML)
  → eventCenter.dispatch('stateChange')
  → renderer: Muya onChange callback
  → editorStore: markdown content updated
  → debouncedSendBufferedState() → IPC: 'update-buffer-state' → main EditorBufferStore
```

---

## 6. State Management (Renderer)

All state lives in Pinia stores (`src/renderer/src/store/`):

| Store | Responsibility | File |
|-------|---------------|------|
| `editor` | Open tabs, document content, cursors, TOC | `editor.ts` |
| `preferences` | User settings (mirrors main Preference class) | `preferences.ts` |
| `layout` | SideBar visibility, tab bar, rightColumn | `layout.ts` |
| `project` | Open folder tree, file listing | `project.ts` |
| `commandCenter` | Registered commands, palette state | `commandCenter.ts` |
| `notification` | Toast notifications | `notification.ts` |
| `autoUpdates` | Auto-update state | `autoUpdates.ts` |
| `help` | Help content | `help.ts` |

Cross-store communication uses the Pinia `useXxxStore()` pattern (not Vuex-style modules).
The event bus (`src/renderer/src/bus/`) handles Muya → store communication.

---

## 7. Window Types

Two window types defined in `src/main/windows/`:

| Type | Class | Purpose |
|------|-------|---------|
| `EDITOR` | `EditorWindow (editor.ts)` | Main document editing window |
| `SETTINGS` | `SettingWindow (setting.ts)` | Preferences dialog window |

Both extend `BaseWindow (base.ts)`.

---

## 8. Build System

- **Dev**: `electron-vite` with Vite HMR for renderer; main/preload restart required.
- **Output targets**: main → CommonJS; preload → CommonJS; renderer → ESM.
- **Path aliases** (defined in `electron.vite.config.ts`):
  - `@` → `src/renderer/src`
  - `common` → `src/common`
  - `muya` → `src/muya`
- **Native modules**: `electron-rebuild` required after Electron version bump.
- **Locale minification**: `pnpm run minify-locales` required for production builds.

---

## 9. TypeScript Configuration

- `tsconfig.base.json`: `strict: true`, `moduleResolution: bundler`.
- `src/muya/` is excluded from TypeScript compilation; covered by `src/types/muya.d.ts` ambient shim.
- Cross-process types: `src/shared/types/` (imported by main, preload, and renderer).
- Renderer-global types: `src/types/global.d.ts` (defines `window.electron`, `window.fileUtils`, etc.).

---

## 10. Key Architectural Invariants

1. **Renderer cannot import Node.js modules**. All Node access goes through `window.*` contextBridge APIs.
2. **Muya does not import Electron APIs** (exception: zlib in plantuml.js — acceptable).
3. **IPC channels are typed** at every call site via generics in `src/shared/types/ipc.ts`.
4. **ContentState is a mixin composition** — 25 controllers patch `ContentState.prototype` at module load time.
5. **Preferences are persisted in main** (Preference class), reflected in renderer via IPC on startup.
6. **EditorBufferStore** (main) is a crash-recovery mechanism that persists unsaved content.
7. **Single instance lock** prevents two MarkText instances (except on macOS and in dev mode).
