// Sandboxed preload: only `electron` can be required, and only a tiny subset of
// `process` is available (platform, versions, env). Everything else lives in
// the main process and is reached via IPC.

import { contextBridge, ipcRenderer, webFrame, webUtils } from 'electron'
import pathBrowserify from 'path-browserify'

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args)
const send = (channel, ...args) => ipcRenderer.send(channel, ...args)

// One synchronous handshake at startup so the renderer can read platform/env
// without an `await` from inside Vue computed properties etc.
const bootInfo = ipcRenderer.sendSync('mt::boot-info')

const ipcWrapper = {
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
  sendSync: (channel, ...args) => ipcRenderer.sendSync(channel, ...args),
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, listener) => {
    const subscription = (_event, ...args) => listener(_event, ...args)
    ipcRenderer.on(channel, subscription)
    return () => ipcRenderer.removeListener(channel, subscription)
  },
  once: (channel, listener) => {
    const subscription = (_event, ...args) => listener(_event, ...args)
    ipcRenderer.once(channel, subscription)
    return () => ipcRenderer.removeListener(channel, subscription)
  },
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
}

const shellAPI = {
  openExternal: (url) => invoke('mt::shell::open-external', url),
  showItemInFolder: (fullPath) => send('mt::shell::show-item', fullPath),
  openPath: (fullPath) => invoke('mt::shell::open-path', fullPath)
}

const clipboardAPI = {
  writeText: (text) => send('mt::clipboard::write-text', text),
  readText: () => invoke('mt::clipboard::read-text'),
  guessFilePath: () => invoke('mt::clipboard::guess-file-path')
}

const webFrameAPI = {
  setZoomFactor: (factor) => {
    if (typeof factor === 'number' && factor > 0) webFrame.setZoomFactor(factor)
  },
  setZoomLevel: (level) => {
    if (typeof level === 'number') webFrame.setZoomLevel(level)
  }
}

const webUtilsAPI = {
  getPathForFile: (file) => webUtils.getPathForFile(file)
}

const windowControlAPI = {
  minimize: () => send('mt::win::minimize'),
  maximize: () => send('mt::win::maximize'),
  unmaximize: () => send('mt::win::unmaximize'),
  toggleMaximize: () => send('mt::win::toggle-maximize'),
  close: () => send('mt::win::close'),
  setFullScreen: (flag) => send('mt::win::set-fullscreen', flag),
  toggleFullScreen: () => send('mt::win::toggle-fullscreen'),
  isMaximized: () => invoke('mt::win::is-maximized'),
  isFullScreen: () => invoke('mt::win::is-fullscreen'),
  popupMenu: (template, position) => send('mt::menu::popup', template, position),
  popupApplicationMenu: (position) => send('mt::menu::popup-application', position)
}

// These three predicates are pure path-string operations: implementing them
// in the preload keeps them synchronous so existing call sites like
// `tabs.find(t => isSamePathSync(t.pathname, ...))` keep returning the right
// item instead of a truthy Promise.
const MARKDOWN_EXTENSIONS = [
  'markdown', 'mdown', 'mkdn', 'md', 'mkd', 'mdwn', 'mdtxt', 'mdtext', 'mdx', 'text', 'txt'
]

const hasMarkdownExtension = (filename) => {
  if (!filename || typeof filename !== 'string') return false
  return MARKDOWN_EXTENSIONS.some((ext) => filename.toLowerCase().endsWith(`.${ext}`))
}

const isChildOfDirectory = (dir, child) => {
  if (!dir || !child) return false
  const relative = pathBrowserify.relative(dir, child)
  return !!relative && !relative.startsWith('..') && !pathBrowserify.isAbsolute(relative)
}

const isSamePathSync = (pathA, pathB, isNormalized = false) => {
  if (!pathA || !pathB) return false
  const a = isNormalized ? pathA : pathBrowserify.normalize(pathA)
  const b = isNormalized ? pathB : pathBrowserify.normalize(pathB)
  if (a.length !== b.length) return false
  if (a === b) return true
  if (a.toLowerCase() === b.toLowerCase()) {
    // Case-insensitive filesystem fallback — block briefly on a sync IPC
    // because callers (tab matching) need a boolean answer right now.
    try {
      return ipcRenderer.sendSync('mt::paths::is-same-sync', a, b)
    } catch {
      return false
    }
  }
  return false
}

const fileUtilsAPI = {
  isFile: (p) => invoke('mt::fs::is-file', p),
  isDirectory: (p) => invoke('mt::fs::is-directory', p),
  emptyDir: (p) => invoke('mt::fs::empty-dir', p),
  copy: (src, dest) => invoke('mt::fs::copy', src, dest),
  ensureDir: (p) => invoke('mt::fs::ensure-dir', p),
  outputFile: (p, data) => invoke('mt::fs::output-file', p, data),
  move: (src, dest) => invoke('mt::fs::move', src, dest),
  stat: (p) => invoke('mt::fs::stat', p),
  writeFile: (p, data) => invoke('mt::fs::write-file', p, data),
  readFile: (p, encoding) => invoke('mt::fs::read-file', p, encoding),
  pathExists: (p) => invoke('mt::fs::path-exists', p),
  unlink: (p) => invoke('mt::fs::unlink', p),
  readdir: (p) => invoke('mt::fs::readdir', p),
  isExecutable: (p) => invoke('mt::fs::is-executable', p),
  // Pure-string predicates — synchronous, no IPC for the common case.
  isChildOfDirectory,
  hasMarkdownExtension,
  isSamePathSync,
  // isImageFile needs an fs.statSync; keep it async via IPC.
  isImageFile: (p) => invoke('mt::paths::is-image', p),
  MARKDOWN_INCLUSIONS: bootInfo?.MARKDOWN_INCLUSIONS || []
}

const commandAPI = {
  exists: (name) => invoke('mt::cmd::exists', name)
}

const i18nAPI = {
  loadTranslations: (language) => invoke('mt::i18n::load', language)
}

const ripgrepAPI = {
  start: (req) => invoke('mt::rg::start', req),
  cancel: (searchId) => send('mt::rg::cancel', searchId),
  onMatch: (handler) => {
    const sub = (_e, payload) => handler(payload)
    ipcRenderer.on('mt::rg::match', sub)
    return () => ipcRenderer.removeListener('mt::rg::match', sub)
  },
  onProgress: (handler) => {
    const sub = (_e, payload) => handler(payload)
    ipcRenderer.on('mt::rg::progress', sub)
    return () => ipcRenderer.removeListener('mt::rg::progress', sub)
  },
  onDone: (handler) => {
    const sub = (_e, payload) => handler(payload)
    ipcRenderer.on('mt::rg::done', sub)
    return () => ipcRenderer.removeListener('mt::rg::done', sub)
  },
  onError: (handler) => {
    const sub = (_e, payload) => handler(payload)
    ipcRenderer.on('mt::rg::error', sub)
    return () => ipcRenderer.removeListener('mt::rg::error', sub)
  },
  onCancelled: (handler) => {
    const sub = (_e, payload) => handler(payload)
    ipcRenderer.on('mt::rg::cancelled', sub)
    return () => ipcRenderer.removeListener('mt::rg::cancelled', sub)
  }
}

const uploaderAPI = {
  uploadImage: (req) => invoke('mt::uploader::upload', req)
}

const fontsAPI = {
  list: () => invoke('mt::fonts::list')
}

const electronAPI = {
  ipcRenderer: ipcWrapper,
  shell: shellAPI,
  clipboard: clipboardAPI,
  webFrame: webFrameAPI,
  webUtils: webUtilsAPI,
  process: {
    platform: bootInfo?.platform || process.platform,
    arch: bootInfo?.arch,
    versions: bootInfo?.versions || {},
    env: bootInfo?.env || {},
    resourcesPath: bootInfo?.paths?.resources,
    cwd: bootInfo?.paths?.cwd
  },
  paths: bootInfo?.paths || {},
  isUpdatable: !!bootInfo?.isUpdatable,
  windowControl: windowControlAPI
}

// Expose a Node-`path`-compatible API to the renderer. path-browserify is a
// pure-JS reimplementation that works inside a sandboxed renderer.
const pathAPI = {
  basename: (...args) => pathBrowserify.basename(...args),
  dirname: (...args) => pathBrowserify.dirname(...args),
  extname: (...args) => pathBrowserify.extname(...args),
  join: (...args) => pathBrowserify.join(...args),
  resolve: (...args) => pathBrowserify.resolve(...args),
  relative: (...args) => pathBrowserify.relative(...args),
  isAbsolute: (...args) => pathBrowserify.isAbsolute(...args),
  normalize: (...args) => pathBrowserify.normalize(...args),
  parse: (...args) => pathBrowserify.parse(...args),
  format: (...args) => pathBrowserify.format(...args),
  sep: pathBrowserify.sep,
  delimiter: pathBrowserify.delimiter,
  posix: pathBrowserify.posix,
  win32: pathBrowserify.win32
}

// Bundled third-party packages occasionally read `process.platform` at module
// load time (e.g. @hfelix/electron-localshortcut/src/utils.js). Expose a
// minimal browser-safe `process` global so those imports don't throw before
// the Vue app can mount.
const processShim = {
  platform: bootInfo?.platform || process.platform,
  arch: bootInfo?.arch,
  versions: bootInfo?.versions || {},
  env: bootInfo?.env || {},
  resourcesPath: bootInfo?.paths?.resources,
  cwd: () => bootInfo?.paths?.cwd,
  // Some libraries call `process.nextTick`; map it to the microtask queue.
  nextTick: (fn, ...args) => Promise.resolve().then(() => fn(...args))
}

try {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('process', processShim)
  contextBridge.exposeInMainWorld('rgPath', bootInfo?.paths?.ripgrepBinary || '')
  contextBridge.exposeInMainWorld('fileUtils', fileUtilsAPI)
  contextBridge.exposeInMainWorld('path', pathAPI)
  contextBridge.exposeInMainWorld('commandExists', commandAPI)
  contextBridge.exposeInMainWorld('i18nUtils', i18nAPI)
  contextBridge.exposeInMainWorld('ripgrep', ripgrepAPI)
  contextBridge.exposeInMainWorld('uploader', uploaderAPI)
  contextBridge.exposeInMainWorld('fonts', fontsAPI)
} catch (error) {
  console.error(error)
}
