// Module shims for third-party libraries that ship no type declarations.
// Each entry is `any`-typed; refine as we discover the real shape.

declare module 'dom-autoscroller'
declare module 'flowchart.js'
declare module 'joplin-turndown-plugin-gfm'
declare module 'snapsvg-cjs'
declare module '@hfelix/electron-localshortcut'
declare module 'execall'
declare module 'iso-639-1'
declare module 'fuzzaldrin'
declare module 'underscore' {
  export function debounce<T extends (...args: never[]) => unknown>(
    fn: T,
    wait?: number,
    immediate?: boolean
  ): T & { cancel: () => void }
}
declare module 'ced'
declare module 'font-list'
declare module 'command-exists'
declare module 'pako'
declare module 'snabbdom-to-html'
declare module 'prismjs/themes/*'
// `codemirror` (the bare module) is typed by `@types/codemirror`; only the
// submodules below ship no declarations and are shimmed as `any`.
declare module 'codemirror/keymap/*'
declare module 'codemirror/lib/*'
declare module 'codemirror/mode/*'
declare module 'codemirror/addon/*'
declare module 'electron-window-state'
declare module 'plist'
declare module 'webfontloader'
declare module 'minimatch' {
  export function minimatch(target: string, pattern: string, options?: unknown): boolean
}

declare module '@marktext/file-icons' {
  interface FileIcon {
    getClass(colourMode?: number, asObject?: boolean): string
  }
  interface FileIcons {
    matchName(name: string): FileIcon | null
    matchLanguage(lang: string): FileIcon | null
  }
  const fileIcons: FileIcons
  export default fileIcons
}

// Electron augments `process` with `resourcesPath` (and a few other fields)
// at runtime. Surface them so common/* code can read them without casts.
declare namespace NodeJS {
  interface Process {
    resourcesPath: string
  }
  interface Global {
    __static: string
    MARKTEXT_DEBUG: boolean
    MARKTEXT_DEBUG_VERBOSE: number
    MARKTEXT_SAFE_MODE: boolean
  }
}

// Main-process globals set at boot in src/main/{globalSetting,app/env}. The
// renderer exposes its own `__static` via the build-time define block.
// eslint-disable-next-line no-var
declare var __static: string
// eslint-disable-next-line no-var
declare var MARKTEXT_DEBUG: boolean
// eslint-disable-next-line no-var
declare var MARKTEXT_DEBUG_VERBOSE: number
// eslint-disable-next-line no-var
declare var MARKTEXT_SAFE_MODE: boolean
