// Renderer-side global declarations: build-time defines (electron-vite
// `define` block in electron.vite.config.ts), the contextBridge surface
// exposed by src/preload/index.ts, and a handful of legacy globals that
// survived the sandbox migration.

import type {
  IpcInvokeChannels,
  IpcSendChannels,
  IpcSyncChannels,
  IpcMainEventChannels,
  BootInfo
} from '@shared/types/ipc'
import type { MenuTemplate, MenuPopupPosition } from '@shared/types/menu'
import type { SerializedStat } from '@shared/types/files'

declare global {
  // ---- Build-time defines (electron-vite `define`) ----
  const MARKTEXT_VERSION: string
  const MARKTEXT_VERSION_STRING: string
  const __static: string

  // ---- contextBridge surface ----

  interface ElectronIpcRenderer {
    send<K extends keyof IpcSendChannels>(channel: K, ...args: IpcSendChannels[K]): void
    sendSync<K extends keyof IpcSyncChannels>(
      channel: K,
      ...args: IpcSyncChannels[K]['args']
    ): IpcSyncChannels[K]['ret']
    invoke<K extends keyof IpcInvokeChannels>(
      channel: K,
      ...args: IpcInvokeChannels[K]['args']
    ): Promise<IpcInvokeChannels[K]['ret']>
    on<K extends keyof IpcMainEventChannels>(
      channel: K,
      listener: (event: unknown, ...args: IpcMainEventChannels[K]) => void
    ): () => void
    once<K extends keyof IpcMainEventChannels>(
      channel: K,
      listener: (event: unknown, ...args: IpcMainEventChannels[K]) => void
    ): () => void
    removeAllListeners(channel: keyof IpcMainEventChannels | string): void
  }

  interface ElectronShellAPI {
    openExternal(url: string): Promise<void>
    showItemInFolder(fullPath: string): void
    openPath(fullPath: string): Promise<string>
  }

  interface ElectronClipboardAPI {
    writeText(text: string): void
    readText(): Promise<string>
    guessFilePath(): Promise<string | null>
  }

  interface ElectronWebFrameAPI {
    setZoomFactor(factor: number): void
    setZoomLevel(level: number): void
  }

  interface ElectronWebUtilsAPI {
    getPathForFile(file: File): string
  }

  interface ElectronWindowControlAPI {
    minimize(): void
    maximize(): void
    unmaximize(): void
    toggleMaximize(): void
    close(): void
    setFullScreen(flag: boolean): void
    toggleFullScreen(): void
    isMaximized(): Promise<boolean>
    isFullScreen(): Promise<boolean>
    popupMenu(template: MenuTemplate, position?: MenuPopupPosition): void
    popupApplicationMenu(position?: MenuPopupPosition): void
  }

  interface ElectronAPI {
    ipcRenderer: ElectronIpcRenderer
    shell: ElectronShellAPI
    clipboard: ElectronClipboardAPI
    webFrame: ElectronWebFrameAPI
    webUtils: ElectronWebUtilsAPI
    process: {
      platform: NodeJS.Platform
      arch?: string
      versions: Record<string, string>
      env: Record<string, string>
      resourcesPath?: string
      cwd?: string
    }
    paths: Partial<BootInfo['paths']>
    isUpdatable: boolean
    windowControl: ElectronWindowControlAPI
  }

  interface FileUtilsAPI {
    isFile(p: string): Promise<boolean>
    isDirectory(p: string): Promise<boolean>
    emptyDir(p: string): Promise<void>
    copy(src: string, dest: string): Promise<void>
    ensureDir(p: string): Promise<void>
    outputFile(p: string, data: string | Uint8Array): Promise<void>
    move(src: string, dest: string): Promise<void>
    stat(p: string): Promise<SerializedStat>
    writeFile(p: string, data: string | Uint8Array): Promise<void>
    readFile(p: string, encoding?: string): Promise<string | Uint8Array>
    pathExists(p: string): Promise<boolean>
    unlink(p: string): Promise<void>
    readdir(p: string): Promise<string[]>
    isExecutable(p: string): Promise<boolean>
    isChildOfDirectory(dir: string, child: string): boolean
    hasMarkdownExtension(filename: string): boolean
    isSamePathSync(a: string, b: string, isNormalized?: boolean): boolean
    isImageFile(p: string): Promise<boolean>
    MARKDOWN_INCLUSIONS: string[]
  }

  interface PathAPI {
    basename(path: string, ext?: string): string
    dirname(path: string): string
    extname(path: string): string
    join(...paths: string[]): string
    resolve(...paths: string[]): string
    relative(from: string, to: string): string
    isAbsolute(path: string): boolean
    normalize(path: string): string
    parse(path: string): { root: string; dir: string; base: string; ext: string; name: string }
    format(pathObject: {
      root?: string
      dir?: string
      base?: string
      ext?: string
      name?: string
    }): string
    sep: string
    delimiter: string
  }

  interface CommandExistsAPI {
    exists(name: string): Promise<boolean>
  }

  interface I18nUtilsAPI {
    loadTranslations(language: string): Promise<Record<string, unknown>>
  }

  interface RipgrepAPI {
    start(req: unknown): Promise<{ searchId: string }>
    cancel(searchId: string): void
    onMatch(handler: (payload: unknown) => void): () => void
    onProgress(handler: (payload: unknown) => void): () => void
    onDone(handler: (payload: unknown) => void): () => void
    onError(handler: (payload: unknown) => void): () => void
    onCancelled(handler: (payload: unknown) => void): () => void
  }

  interface UploaderAPI {
    uploadImage(req: unknown): Promise<unknown>
  }

  interface FontsAPI {
    list(): Promise<string[]>
  }

  interface ProcessShim {
    platform: NodeJS.Platform
    arch?: string
    versions: Record<string, string>
    env: Record<string, string>
    resourcesPath?: string
    cwd: () => string | undefined
    nextTick: (fn: (...args: unknown[]) => void, ...args: unknown[]) => void
  }

  interface Window {
    electron: ElectronAPI
    fileUtils: FileUtilsAPI
    path: PathAPI
    commandExists: CommandExistsAPI
    i18nUtils: I18nUtilsAPI
    ripgrep: RipgrepAPI
    uploader: UploaderAPI
    fonts: FontsAPI
    process: ProcessShim
    rgPath: string
    // Set by the legacy editor store at runtime; consumed by muya internals.
    DIRNAME: string
    marktext?: {
      env?: { windowId: number; [key: string]: unknown }
      initialState?: {
        codeFontFamily?: string | null
        codeFontSize?: string | null
        hideScrollbar?: boolean
        theme?: string | null
        titleBarStyle?: string | null
        [key: string]: unknown
      }
      paths?: { ripgrepBinaryPath?: string; [key: string]: unknown }
      [key: string]: unknown
    }
  }
}

export {}
