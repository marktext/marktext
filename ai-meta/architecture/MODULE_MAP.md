# Module Map — MarkText

> Authoritative file-to-logical-module index. Every entry is based on direct code evidence.
> Use this map to locate the correct files before making any change.

---

## MAIN PROCESS (`src/main/`)

| Logical Module | Key Files | Responsibility |
|----------------|-----------|----------------|
| Entry | `index.ts` | App bootstrap, single-instance lock, crash reporter, CLI parsing |
| Application | `app/index.ts` | `App` class; window lifecycle, IPC main listeners, theme, language |
| Accessor | `app/accessor.ts` | Service locator aggregating all main subsystems |
| Environment | `app/env.ts` | `AppEnvironment` setup (paths, flags, dev/prod detection) |
| Paths | `app/paths.ts` | `AppPaths` — resolves userData, log, temp paths |
| Native Theme | `app/nativeTheme.ts` | System dark/light theme detection |
| Window Base | `windows/base.ts` | `BaseWindow` — common BrowserWindow config |
| Editor Window | `windows/editor.ts` | `EditorWindow` — document editing window |
| Settings Window | `windows/setting.ts` | `SettingWindow` — preferences dialog |
| Window Manager | `app/windowManager.ts` | Opens/closes/tracks editor windows |
| Preferences | `preferences/index.ts` | Reads/writes `preference.json` on disk |
| Preferences Schema | `preferences/schema.json` | JSON Schema for validated preference values |
| Data Center | `dataCenter/` | Persists recently opened files/dirs |
| Editor Buffer Store | `editorBufferStore/` | Crash-recovery buffer for unsaved content |
| IPC Router | `ipc/index.ts` | Registers all sandboxed IPC handlers |
| IPC: Boot | `ipc/bootInfo.ts` | Sync boot-info handshake handler |
| IPC: File System | `ipc/fs.ts` | File read/write/copy/move/stat handlers |
| IPC: Window | `ipc/window.ts` | Window state (fullscreen, maximize) handlers |
| IPC: Fonts | `ipc/fonts.ts` | System font enumeration |
| IPC: Shell | `ipc/shell.ts` | openExternal, showItemInFolder, openPath |
| IPC: Ripgrep | `ipc/ripgrep.ts` | Full-text search via ripgrep binary |
| IPC: I18n | `ipc/i18n.ts` | Language loading, supported list |
| IPC: Uploader | `ipc/uploader.ts` | Image upload to cloud services |
| IPC: Paths | `ipc/paths.ts` | Path utility helpers |
| IPC: Commands | `ipc/cmd.ts` | Shell command existence check |
| Keyboard | `keyboard/shortcutHandler.ts` | Keybinding registry and dispatch |
| Menu | `menu/index.ts` | `AppMenu` — native application menu |
| Menu Actions | `menu/actions/` | Individual menu action handlers |
| Menu Templates | `menu/templates/` | Menu structure definitions |
| Context Menu | `contextMenu/` | Right-click context menus |
| Spell Checker | `spellchecker/index.ts` | hunspell/system spell check integration |
| CLI | `cli/index.ts` | Argument parsing (minimist-based) |
| CLI Parser | `cli/parser.ts` | Argument normalization |
| Filesystem | `filesystem/index.ts` | Path normalization, markdown path resolution |
| Filesystem Encoding | `filesystem/encoding.ts` | File encoding detection |
| Filesystem Watcher | `filesystem/watcher.ts` | File system change watchers |
| Exception Handler | `exceptionHandler.ts` | Uncaught exception logging + Sentry-style capture |
| Global Settings | `globalSetting.ts` | Compile-time globals (MARKTEXT_VERSION, etc.) |
| Config | `config.ts` | Platform flags (isOsx, isWindows, isLinux) |
| Utils | `utils/` | Image path auto-complement, misc helpers |
| i18n | `i18n.ts` | Main-process translation (t() wrapper) |

---

## PRELOAD (`src/preload/`)

| Logical Module | File | Responsibility |
|----------------|------|----------------|
| Bridge Entry | `index.ts` | Entire preload — exposes contextBridge APIs |

Exposed APIs (via `contextBridge.exposeInMainWorld`):
- `window.electron` — typed IPC wrapper (invoke, send, on, once, removeAllListeners)
- `window.fileUtils` — file I/O operations
- `window.path` — pathe path utilities
- `window.webUtils` — webUtils.getPathForFile
- `window.shell` — openExternal, openPath, showItemInFolder
- `window.clipboard` — writeText, readText, guessFilePath
- `window.i18n` — load, isSupportedLanguage, supportedLanguages
- `window.marktext` — bootInfo, env, paths, versions

---

## RENDERER (`src/renderer/src/`)

| Logical Module | Key Files | Responsibility |
|----------------|-----------|----------------|
| Entry | `main.ts` | Vue app creation, plugin registration, mount |
| App Root | `Main.vue` | Root component |
| Bootstrap | `bootstrap.ts` | Pre-Vue initialization (marktext global, boot data) |
| Router | `router/index.ts` | Route definitions (editor / settings window types) |
| Stores | `store/index.ts` | Pinia root + re-exports |
| Store: Editor | `store/editor.ts` | Document state, tabs, markdown content, TOC |
| Store: Preferences | `store/preferences.ts` | User settings mirror + preference actions |
| Store: Layout | `store/layout.ts` | UI layout (sidebar, tab bar, rightColumn) |
| Store: Project | `store/project.ts` | Folder tree, file listing |
| Store: Commands | `store/commandCenter.ts` | Command palette registry |
| Store: Buffered | `store/bufferedState.ts` | Debounced state sync to main EditorBufferStore |
| Store: Listen | `store/listenForMain.ts` | IPC push event listeners (main → renderer) |
| Event Bus | `bus/index.ts` | Vue event bus for muya ↔ store communication |
| i18n | `i18n/index.ts` | Vue i18n plugin; language loading |
| Config | `config.ts` | Renderer-side constants (PATH_SEPARATOR, etc.) |
| Components: Editor | `components/editorWithTabs/` | Main editor + tab bar |
| Components: Search | `components/search/` | Find/replace UI |
| Components: SideBar | `components/sideBar/` | File tree sidebar |
| Components: TitleBar | `components/titleBar/` | Custom title bar |
| Components: Command Palette | `components/commandPalette/` | Command palette overlay |
| Components: Export | `components/exportSettings/` | Export dialog |
| Components: Import | `components/import/` | Import dialog |
| Components: Rename | `components/rename/` | File rename dialog |
| Components: Loading | `components/loading/` | Loading spinner |
| Components: Recent | `components/recent/` | Recent files list |
| Components: About | `components/about/` | About dialog |
| Pref Components | `prefComponents/` | Settings window UI components |
| Pages | `pages/` | Top-level route pages |
| Services | `services/` | Notification service, misc |
| Util | `util/` | deepClone, getUniqueId, listToTree, fileSystem helpers |
| Node Utilities | `node/` | Renderer-side Node-like utilities (delegated to preload) |
| Spell Checker | `spellchecker/` | Renderer-side spell check UI integration |
| Context Menu | `contextMenu/` | Renderer-side context menu builders |
| CodeMirror | `codeMirror/` | Source-code editing mode (CodeMirror 6) |
| Commands | `commands/` | Renderer command definitions |
| Axios | `axios/index.ts` | Axios instance (for image uploader) |
| Assets | `assets/` | CSS, icons, fonts |

---

## MUYA (`src/muya/lib/`)

| Logical Module | Key Files | Responsibility |
|----------------|-----------|----------------|
| Public API | `index.js` | `Muya` class — public interface, plugin system |
| ContentState | `contentState/index.js` | Document block tree root; assembles all mixins |
| CS: Core | `contentState/core.js` | replaceWordInline, partialRender |
| CS: Input | `contentState/inputCtrl.js` | Keystroke input handling |
| CS: Format | `contentState/formatCtrl.js` | Bold, italic, code, etc. |
| CS: Enter | `contentState/enterCtrl.js` | Enter key / paragraph splitting |
| CS: Backspace | `contentState/backspaceCtrl.js` | Backspace / block merging |
| CS: Delete | `contentState/deleteCtrl.js` | Delete key handling |
| CS: Arrow | `contentState/arrowCtrl.js` | Cursor arrow navigation |
| CS: Tab | `contentState/tabCtrl.js` | Tab / list indentation |
| CS: Paste | `contentState/pasteCtrl.js` | Paste with markdown normalization |
| CS: Copy/Cut | `contentState/copyCutCtrl.js` | Copy/cut with selection |
| CS: Click | `contentState/clickCtrl.js` | Mouse click → cursor positioning |
| CS: Search | `contentState/searchCtrl.js` | In-document find/replace |
| CS: Image | `contentState/imageCtrl.js` | Image insertion and path resolution |
| CS: Link | `contentState/linkCtrl.js` | Link insertion and editing |
| CS: Table | `contentState/tableBlockCtrl.js` | Table creation and editing |
| CS: Table Drag | `contentState/tableDragBarCtrl.js` | Table column drag-resize |
| CS: Table Select | `contentState/tableSelectCellsCtrl.js` | Table cell multi-select |
| CS: Code Block | `contentState/codeBlockCtrl.js` | Fenced code block editing |
| CS: Container | `contentState/containerCtrl.js` | GitHub-style alert/container blocks |
| CS: DragDrop | `contentState/dragDropCtrl.js` | Block drag-and-drop reordering |
| CS: Emoji | `contentState/emojiCtrl.js` | Emoji picker integration |
| CS: Footnote | `contentState/footnoteCtrl.js` | Footnote insertion and editing |
| CS: Paragraph | `contentState/paragraphCtrl.js` | Paragraph creation and splitting |
| CS: TOC | `contentState/tocCtrl.js` | Table of contents generation |
| CS: HTML Block | `contentState/htmlBlock.js` | Raw HTML block handling |
| CS: Update | `contentState/updateCtrl.js` | State update and re-render triggering |
| CS: History | `contentState/history.js` | Undo/redo stack |
| CS: MarkText | `contentState/marktext.js` | MarkText-specific block types |
| Parser | `parser/index.js` | Inline tokenizer entry point |
| Parser Rules | `parser/rules.js` | Inline regex rules |
| Parser Utils | `parser/utils.js` | Token parsing utilities |
| Parser Marked | `parser/marked/` | Forked marked.js block parser |
| Parser Render | `parser/render/` | Token → HTML render (math, code, plantuml) |
| Renderers | `renderers/` | WYSIWYG block renderers |
| Event: Center | `eventHandler/event.js` | DOM event subscription system |
| Event: Keyboard | `eventHandler/keyboard.js` | Keyboard event routing |
| Event: Mouse | `eventHandler/mouseEvent.js` | Mouse event handling |
| Event: Click | `eventHandler/clickEvent.js` | Click event specialization |
| Event: Clipboard | `eventHandler/clipboard.js` | Clipboard read/write |
| Event: DragDrop | `eventHandler/dragDrop.js` | File/block drag-drop |
| Event: Resize | `eventHandler/resize.js` | Editor resize observer |
| Selection | `selection/` | DOM selection and cursor management |
| UI: Tooltip | `ui/tooltip.js` | Inline format tooltip |
| UI: Others | `ui/` | Emoji picker, table picker, image toolbar, etc. |
| Utils | `utils/` | wordCount, debounce, exportMarkdown, exportHtml, etc. |
| Config | `config/` | CLASS_OR_ID constants, MUYA_DEFAULT_OPTION |
| Themes | `themes/` | Editor CSS themes |
| Prism | `prism/` | Syntax highlighting (prism.js integration) |
| Assets | `assets/` | CSS |

---

## SHARED (`src/shared/`)

| Logical Module | File | Responsibility |
|----------------|------|----------------|
| IPC Contract | `types/ipc.ts` | All typed IPC channel interfaces |
| File Types | `types/files.ts` | MarkdownDocument, IFileState, TabOptions, etc. |
| Menu Types | `types/menu.ts` | MenuTemplate, MenuPopupPosition |
| Preferences Types | `types/preferences.ts` | Preference value types |
| Buffered State | `types/bufferedState.ts` | BufferedState shape |
| Bus Types | `types/bus.ts` | Event bus channel types |
| Type Emitter | `types/typedEmitter.ts` | TypedEmitter utility |
| Barrel | `index.ts` | Re-exports |

---

## COMMON (`src/common/`)

| Logical Module | File | Responsibility |
|----------------|------|----------------|
| Encoding | `encoding.ts` | Character encoding utilities |
| Env Paths | `envPaths.ts` | Platform-specific app data paths |
| i18n | `i18n.ts` | Shared translation loading |
| Theme | `theme.ts` | Theme name resolution |
| Commands | `commands/` | Shared command definitions |
| Filesystem | `filesystem/` | Path utilities (isChildOfDirectory, etc.) |
| Keybinding | `keybinding/` | Keybinding format parsing |

---

## TEST (`test/`)

| Suite | Path | Tool |
|-------|------|------|
| Unit | `test/unit/specs/*.spec.js` | Vitest |
| E2E | `test/e2e/*.spec.js` | Playwright |
