import { contextBridge, shell, clipboard, webUtils, ipcRenderer } from 'electron'
import crypto from 'crypto'
import zlib from 'zlib'
import fs from 'fs-extra'
import { isFile, isDirectory, ensureDirSync } from 'common/filesystem'
import { electronAPI } from '@electron-toolkit/preload'
import {
  isChildOfDirectory,
  hasMarkdownExtension,
  MARKDOWN_INCLUSIONS,
  isSamePathSync,
  isImageFile
} from 'common/filesystem/paths'
import path from 'path'
import os from 'os'
import commandExists from 'command-exists'
import { loadTranslations } from 'common/i18n'

const i18nUtils = {
  loadTranslations
}

const customElectronAPI = {
  shell,
  clipboard,
  webUtils
}

const fileUtilsAPI = {
  isFile: (p) => isFile(p),
  isDirectory: (p) => isDirectory(p),
  emptyDir: (p) => fs.emptyDir(p),
  copy: (src, dest) => fs.copy(src, dest),
  ensureDir: (p) => fs.ensureDir(p),
  outputFile: (p, data) => fs.outputFile(p, data),
  move: (src, dest) => fs.move(src, dest),
  stat: (p) => fs.stat(p),
  writeFile: (p, data) => fs.writeFile(p, data),
  readFile: (p) => fs.readFile(p),
  ensureDirSync: (p) => ensureDirSync(p),
  pathExistsSync: (p) => fs.pathExistsSync(p),
  isChildOfDirectory: (dir, child) => isChildOfDirectory(dir, child),
  hasMarkdownExtension: (filename) => hasMarkdownExtension(filename),
  MARKDOWN_INCLUSIONS,
  isSamePathSync: (pathA, pathB) => isSamePathSync(pathA, pathB),
  isImageFile: (filepath) => isImageFile(filepath)
}

const commandAPI = {
  exists: (command) => {
    try {
      if (commandExists.sync(command)) {
        return true
      }

      if (command === 'picgo' && process.platform === 'darwin') {
        const commonPaths = [
          '/usr/local/bin/picgo',
          '/opt/homebrew/bin/picgo',
          `${process.env.HOME}/.npm-global/bin/picgo`,
          `${process.env.HOME}/.npm/bin/picgo`,
          '/usr/local/lib/node_modules/.bin/picgo'
        ]

        for (const picgoPath of commonPaths) {
          if (fs.pathExistsSync(picgoPath)) {
            return true
          }
        }
      }

      return false
    } catch (error) {
      console.error('Error checking command existence:', error)
      return false
    }
  }
}

const nodeAPI = {
  platform: process.platform,
  arch: process.arch,
  env: {
    NODE_ENV: process.env.NODE_ENV,
    APPIMAGE: process.env.APPIMAGE,
    MARKTEXT_VERSION_STRING: process.env.MARKTEXT_VERSION_STRING
  },
  resourcesPath: process.resourcesPath,
  tmpdir: () => os.tmpdir(),
  createHash: (algorithm, content, encoding) => {
    return crypto.createHash(algorithm).update(content, encoding).digest('hex')
  },
  bufferFrom: (data, encoding) => {
    const buf = Buffer.from(data, encoding)
    return buf
  },
  bufferByteLength: (str) => {
    return Buffer.byteLength(str)
  },
  bufferToString: (data, encoding) => {
    return Buffer.from(data).toString(encoding)
  },
  deflateSync: (input, options) => {
    const buf = zlib.deflateSync(input, options)
    return buf.toString('base64')
  }
}

const windowControls = {
  minimize: () => ipcRenderer.send('mt::window-minimize'),
  toggleMaximize: () => ipcRenderer.send('mt::window-maximize'),
  close: () => ipcRenderer.send('mt::window-close'),
  toggleFullScreen: () => ipcRenderer.send('mt::window-toggle-fullscreen'),
  setFullScreen: (flag) => ipcRenderer.send('mt::window-set-fullscreen', flag),
  isFullScreen: () => ipcRenderer.invoke('mt::window-is-fullscreen'),
  isMaximized: () => ipcRenderer.invoke('mt::window-is-maximized')
}

const contextMenuAPI = {
  show: (menuTemplate) => ipcRenderer.invoke('mt::show-context-menu', menuTemplate),
  showAppMenu: (x, y) => ipcRenderer.send('mt::show-app-menu', x, y)
}

const clipboardAPI = {
  guessFilePath: () => ipcRenderer.invoke('mt::clipboard-guess-filepath')
}

const fontAPI = {
  getFonts: () => ipcRenderer.invoke('mt::get-system-fonts')
}

const execAPI = {
  upload: (opts) => ipcRenderer.invoke('mt::exec-upload', opts),
  readDirSync: (dirPath) => ipcRenderer.invoke('mt::read-dir-sync', dirPath),
  readFileText: (filePath, encoding) => ipcRenderer.invoke('mt::read-file-text', filePath, encoding),
  isFileExecutable: (filepath) => ipcRenderer.invoke('mt::is-file-executable', filepath),
  ripgrepSearch: (opts) => ipcRenderer.invoke('mt::ripgrep-search', opts),
  ripgrepFileSearch: (opts) => ipcRenderer.invoke('mt::ripgrep-file-search', opts),
  cancelRipgrep: (searchId) => ipcRenderer.send('mt::ripgrep-cancel', searchId),
  onRipgrepData: (callback) => {
    const handler = (event, data) => callback(data)
    ipcRenderer.on('mt::ripgrep-search-data', handler)
    return handler
  },
  onRipgrepDone: (callback) => {
    const handler = (event, data) => callback(data)
    ipcRenderer.on('mt::ripgrep-search-done', handler)
    return handler
  },
  removeRipgrepListener: (channel, handler) => {
    ipcRenderer.removeListener(channel, handler)
  }
}

try {
  contextBridge.exposeInMainWorld('electron', {
    ...electronAPI,
    ...customElectronAPI
  })
  contextBridge.exposeInMainWorld('fileUtils', fileUtilsAPI)
  contextBridge.exposeInMainWorld('path', path)
  contextBridge.exposeInMainWorld('commandExists', commandAPI)
  contextBridge.exposeInMainWorld('i18nUtils', i18nUtils)
  contextBridge.exposeInMainWorld('nodeAPI', nodeAPI)
  contextBridge.exposeInMainWorld('windowControls', windowControls)
  contextBridge.exposeInMainWorld('contextMenuAPI', contextMenuAPI)
  contextBridge.exposeInMainWorld('clipboardAPI', clipboardAPI)
  contextBridge.exposeInMainWorld('fontAPI', fontAPI)
  contextBridge.exposeInMainWorld('execAPI', execAPI)
} catch (error) {
  console.error(error)
}
