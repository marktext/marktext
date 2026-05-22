/**
 * IPC channel contract — single source of truth for renderer↔main messaging.
 *
 * Four channel categories:
 *   - IpcInvokeChannels      : renderer → main, returns Promise<T>
 *   - IpcSendChannels        : renderer → main, fire-and-forget
 *   - IpcSyncChannels        : renderer → main, synchronous
 *   - IpcMainEventChannels   : main → renderer, push events (renderer .on)
 *
 * Channel names are typed strictly; argument and return shapes are
 * intentionally permissive (`unknown[]` / `unknown`) during the migration.
 * Concrete types tighten as each handler/caller converts in commits 5–8.
 *
 * To register a new channel:
 *   1. Add an entry to the appropriate interface here.
 *   2. Wire the handler in src/main (ipcMain.handle / ipcMain.on / webContents.send).
 *   3. Wire the caller via the typed preload bridge in src/preload/index.ts.
 */

import type {
  MarkdownDocument,
  TabOptions,
  BootstrapEditorConfig,
  PageOptions,
  ExportType,
  SaveOptions,
  SerializedStat,
  LineEnding,
  FileChangeDetail,
  UnsavedFile
} from './files'
import type { BufferedState as BufferedStateType } from './bufferedState'
import type { MenuTemplate, MenuPopupPosition } from './menu'

// =================================================================
// Invoke channels (renderer → main, returns Promise<T>)
// =================================================================

export interface IpcInvokeChannels {
  'mt::ask-for-image-path': { args: []; ret: string[] }
  'mt::boot-info-async': { args: []; ret: BootInfo }
  'mt::clipboard::guess-file-path': { args: []; ret: string | null }
  'mt::clipboard::read-text': { args: []; ret: string }
  'mt::cmd::exists': { args: [name: string]; ret: boolean }
  'mt::fonts::list': { args: []; ret: string[] }
  'mt::fs-trash-item': { args: [pathname: string]; ret: void }
  'mt::fs::copy': { args: [src: string, dest: string]; ret: void }
  'mt::fs::empty-dir': { args: [path: string]; ret: void }
  'mt::fs::ensure-dir': { args: [path: string]; ret: void }
  'mt::fs::is-directory': { args: [path: string]; ret: boolean }
  'mt::fs::is-executable': { args: [path: string]; ret: boolean }
  'mt::fs::is-file': { args: [path: string]; ret: boolean }
  'mt::fs::move': { args: [src: string, dest: string]; ret: void }
  'mt::fs::output-file': { args: [path: string, data: string | Uint8Array]; ret: void }
  'mt::fs::path-exists': { args: [path: string]; ret: boolean }
  'mt::fs::read-file': { args: [path: string, encoding?: string]; ret: string | Uint8Array }
  'mt::fs::readdir': { args: [path: string]; ret: string[] }
  'mt::fs::stat': { args: [path: string]; ret: SerializedStat }
  'mt::fs::unlink': { args: [path: string]; ret: void }
  'mt::fs::write-file': { args: [path: string, data: string | Uint8Array]; ret: void }
  'mt::i18n::is-supported': { args: [lang: string]; ret: boolean }
  'mt::i18n::load': { args: [language: string]; ret: Record<string, unknown> }
  'mt::i18n::supported': { args: []; ret: string[] }
  'mt::keybinding-get-keyboard-info': { args: []; ret: unknown }
  'mt::keybinding-get-pref-keybindings': { args: []; ret: unknown }
  'mt::keybinding-save-user-keybindings': { args: [bindings: unknown]; ret: void }
  'mt::paths::is-image': { args: [path: string]; ret: boolean }
  'mt::rg::start': { args: [req: unknown]; ret: { searchId: string } }
  'mt::shell::open-external': { args: [url: string]; ret: void }
  'mt::shell::open-path': { args: [fullPath: string]; ret: string }
  'mt::spellchecker-get-available-dictionaries': { args: []; ret: string[] }
  'mt::spellchecker-get-custom-dictionary-words': { args: []; ret: string[] }
  'mt::spellchecker-remove-word': { args: [word: string]; ret: void }
  'mt::spellchecker-set-enabled': { args: [enabled: boolean]; ret: void }
  'mt::spellchecker-switch-language': { args: [language: string]; ret: void }
  'mt::uploader::upload': { args: [req: unknown]; ret: unknown }
  'mt::win::is-fullscreen': { args: []; ret: boolean }
  'mt::win::is-maximized': { args: []; ret: boolean }
  // Main derives the BrowserWindow via BrowserWindow.fromWebContents(e.sender);
  // no need to pass windowId. Payload is the editor+project+layout snapshot.
  'update-buffer-state': { args: [payload: unknown]; ret: void }
}

// =================================================================
// Send channels (renderer → main, fire-and-forget)
// =================================================================

export interface IpcSendChannels {
  'app-create-editor-window': [config?: unknown]
  'app-create-settings-window': []
  'app-open-directory-by-id': [windowId: number, dirPath: string]
  'app-open-file-by-id': [windowId: number, filePath: string, options?: unknown]
  'app-open-files-by-id': [windowId: number, filePaths: string[], options?: unknown]
  'app-open-markdown-by-id': [windowId: number, markdown: string, options?: unknown]
  'broadcast-preferences-changed': [partial: unknown]
  'broadcast-user-data-changed': [partial: unknown]
  'menu-add-recently-used': [filePath: string]
  'menu-clear-recently-used': []
  'mt::NEED_UPDATE': [payload?: unknown]
  'mt::add-recently-used-document': [filePath: string]
  'mt::app-try-quit': []
  'mt::ask-for-image-auto-path': [payload: unknown]
  'mt::ask-for-modify-image-folder-path': [imagePath?: string]
  'mt::ask-for-open-project-in-sidebar': []
  'mt::ask-for-user-data': []
  'mt::ask-for-user-preference': []
  'mt::check-for-update': []
  'mt::clipboard::write-text': [text: string]
  'mt::close-window': []
  'mt::close-window-confirm': [unsavedFiles: UnsavedFile[]]
  'mt::cmd-close-window': []
  'mt::cmd-import-file': []
  'mt::cmd-new-editor-window': []
  'mt::cmd-open-file': []
  'mt::cmd-open-folder': []
  'mt::cmd-toggle-autosave': []
  'mt::editor-selection-changed': [windowId: number, state: unknown]
  'mt::format-link-click': [payload: { data: unknown; dirname: string }]
  'mt::get-current-language': []
  'mt::handle-renderer-error': [error: unknown]
  'mt::keybinding-debug-dump-keyboard-info': []
  'mt::make-screenshot': []
  'mt::menu::popup': [template: MenuTemplate, position?: MenuPopupPosition]
  'mt::menu::popup-application': [position?: MenuPopupPosition]
  'mt::open-file': [filePath: string, options?: unknown]
  'mt::open-file-by-window-id': [windowId: number, filePath: string, options?: unknown]
  'mt::open-keybindings-config': []
  'mt::open-setting-window': []
  'mt::rename': [payload: { id: string; pathname: string; newPathname: string; currentFile?: unknown }]
  'mt::request-keybindings': []
  'mt::response-export': [
    payload: {
      type: ExportType
      title: string
      content: string
      filename: string
      pathname: string
      pageOptions: PageOptions
    }
  ]
  'mt::response-file-move-to': [payload: { id: string; pathname: string }]
  'mt::response-file-save': [
    id: string,
    filename: string,
    pathname: string,
    markdown: string,
    options: SaveOptions,
    defaultPath: string
  ]
  'mt::response-file-save-as': [
    id: string,
    filename: string,
    pathname: string,
    markdown: string,
    options: SaveOptions,
    defaultPath: string
  ]
  'mt::response-print': []
  'mt::rg::cancel': [searchId: string]
  'mt::save-and-close-tabs': [tabs: unknown[]]
  'mt::save-tabs': [tabs: unknown[]]
  'mt::select-default-directory-to-open': []
  'mt::set-user-data': [partial: unknown]
  'mt::set-user-preference': [partial: unknown]
  'mt::shell::open-external': [url: string]
  'mt::shell::show-item': [fullPath: string]
  'mt::update-format-menu': [windowId: number, state: Record<string, boolean>]
  'mt::update-line-ending-menu': [windowId: number, lineEnding: LineEnding]
  'mt::update-sidebar-menu': [windowId: number, visible: boolean]
  'mt::view-layout-changed': [windowId: number, layout: unknown]
  'mt::win::close': []
  'mt::win::maximize': []
  'mt::win::minimize': []
  'mt::win::set-fullscreen': [flag: boolean]
  'mt::win::toggle-fullscreen': []
  'mt::win::toggle-maximize': []
  'mt::win::unmaximize': []
  'mt::window-add-file-path': [windowId: number, filePath: string]
  'mt::window-initialized': []
  'mt::window-tab-closed': [pathname: string]
  'mt::window-toggle-always-on-top': []
  'mt::window::drop': [payload: unknown]
  'screen-capture': [payload: unknown]
  'set-image-folder-path': [path: string]
  'set-user-preference': [partial: unknown]
  'watcher-unwatch-all-by-id': [windowId: number]
  'watcher-unwatch-directory': [windowId: number, path: string]
  'watcher-unwatch-file': [windowId: number, path: string]
  'watcher-watch-directory': [windowId: number, path: string]
  'watcher-watch-file': [windowId: number, path: string]
  'window-add-file-path': [windowId: number, filePath: string]
  'window-change-file-path': [windowId: number, oldPath: string, newPath: string]
  'window-close-by-id': [windowId: number]
  'window-file-saved': [windowId: number, tabId: string]
  'window-reload-by-id': [windowId: number]
  'window-toggle-always-on-top': [windowId: number]
}

// =================================================================
// Sync channels (synchronous renderer → main)
// =================================================================

export interface IpcSyncChannels {
  'mt::boot-info': { args: []; ret: BootInfo }
  'mt::paths::is-same-sync': { args: [a: string, b: string]; ret: boolean }
}

// =================================================================
// Push events (main → renderer, listened on ipcRenderer.on)
// =================================================================

export interface IpcMainEventChannels {
  'language-changed': [language: string]
  'mt::UPDATE_AVAILABLE': [info?: unknown]
  'mt::UPDATE_DOWNLOADED': [info?: unknown]
  'mt::UPDATE_ERROR': [error: unknown]
  'mt::UPDATE_NOT_AVAILABLE': [info?: unknown]
  'mt::about-dialog': []
  'mt::ask-for-close': []
  'mt::bootstrap-editor': [config: BootstrapEditorConfig]
  'mt::cm-copy-as-html': []
  'mt::cm-copy-as-rich': []
  'mt::cm-insert-paragraph': [direction: 'before' | 'after']
  'mt::cm-paste-as-plain-text': []
  'mt::current-language': [language: string]
  'mt::editor-ask-file-save': []
  'mt::editor-ask-file-save-as': []
  'mt::editor-close-tab': [tabId?: string]
  'mt::editor-edit-action': [action: string]
  'mt::editor-format-action': [payload: { type: string }]
  'mt::editor-move-file': []
  'mt::editor-paragraph-action': [payload: { type: string }]
  'mt::editor-rename-file': []
  'mt::execute-command-by-id': [commandId: string]
  'mt::export-success': [payload: { type: string; filePath: string }]
  'mt::file-saved': [tabId: string]
  'mt::force-close-tabs-by-id': [tabIds: string[]]
  'mt::invalidate-image-cache': []
  'mt::keybindings-response': [bindings: unknown]
  'mt::load-state': [state: BufferedStateType]
  'mt::menu::click': [menuId: string]
  'mt::menu::closed': []
  'mt::new-untitled-tab': [selected?: boolean, markdown?: string]
  'mt::open-directory': [directoryPath: string]
  'mt::open-new-tab': [
    markdownDocument: MarkdownDocument | null,
    options?: TabOptions,
    selected?: boolean
  ]
  'mt::pandoc-not-exists': [opts: Record<string, unknown>]
  'mt::print-service-clearup': []
  'mt::rg::cancelled': [payload: unknown]
  'mt::rg::done': [payload: unknown]
  'mt::rg::error': [payload: unknown]
  'mt::rg::match': [payload: unknown]
  'mt::rg::progress': [payload: unknown]
  'mt::screenshot-captured': []
  'mt::set-line-ending': [lineEnding: LineEnding]
  'mt::set-pathname': [payload: { id: string; pathname: string; filename: string }]
  'mt::set-view-layout': [layout: unknown]
  'mt::show-command-palette': []
  'mt::show-export-dialog': [type: ExportType]
  'mt::show-notification': [payload: unknown]
  'mt::spelling-replace-misspelling': [payload: unknown]
  'mt::spelling-show-switch-language': []
  'mt::switch-tab-by-file_path': [filePath: string]
  'mt::switch-tab-by-index': [index: number]
  'mt::tab-save-failure': [tabId: string, message: string]
  'mt::tab-saved': [tabId: string]
  'mt::tabs-cycle-left': []
  'mt::tabs-cycle-right': []
  'mt::toggle-view-layout-entry': [entry: string]
  'mt::toggle-view-mode-entry': [entry: string]
  'mt::update-file': [payload: { type: 'add' | 'change' | 'unlink'; change: FileChangeDetail }]
  'mt::update-object-tree': [payload: unknown]
  'mt::user-preference': [partial: unknown]
  'mt::window-active-status': [active: boolean]
  'mt::window-enter-full-screen': []
  'mt::window-leave-full-screen': []
  'mt::window-maximize': []
  'mt::window-unmaximize': []
  'mt::window-zoom': [zoomLevel: number]
  'settings::change-tab': [tab: string]
}

// =================================================================
// Auxiliary types
// =================================================================

export interface BootInfo {
  platform: NodeJS.Platform
  arch: string
  versions: Record<string, string>
  env: Record<string, string>
  paths: {
    resources: string
    userData: string
    cwd: string
    ripgrepBinary: string
  }
  isUpdatable: boolean
  MARKDOWN_INCLUSIONS: string[]
}

// =================================================================
// Helper types for the preload bridge generic wrappers
// =================================================================

export type InvokeArgs<K extends keyof IpcInvokeChannels> = IpcInvokeChannels[K]['args']
export type InvokeRet<K extends keyof IpcInvokeChannels> = IpcInvokeChannels[K]['ret']

export type SyncArgs<K extends keyof IpcSyncChannels> = IpcSyncChannels[K]['args']
export type SyncRet<K extends keyof IpcSyncChannels> = IpcSyncChannels[K]['ret']

export type SendArgs<K extends keyof IpcSendChannels> = IpcSendChannels[K]

export type EventArgs<K extends keyof IpcMainEventChannels> = IpcMainEventChannels[K]
