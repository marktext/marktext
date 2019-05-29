import path from 'path'
import fs from 'fs-extra'
import log from 'electron-log'
import chokidar from 'chokidar'
import { getUniqueId, hasMarkdownExtension } from '../utils'
import { exists } from '../filesystem'
import { loadMarkdownFile } from '../filesystem/markdown'
import { isLinux } from '../config'

const EVENT_NAME = {
  dir: 'AGANI::update-object-tree',
  file: 'AGANI::update-file'
}

const add = async (win, pathname, type, endOfLine) => {
  const stats = await fs.stat(pathname)
  const birthTime = stats.birthtime
  const isMarkdown = hasMarkdownExtension(pathname)
  const file = {
    pathname,
    name: path.basename(pathname),
    isFile: true,
    isDirectory: false,
    birthTime,
    isMarkdown
  }
  if (isMarkdown) {
    // HACK: But this should be removed completely in #1034/#1035.
    try {
      const data = await loadMarkdownFile(pathname, endOfLine)
      file.data = data
    } catch(err) {
      // Only notify user about opened files.
      if (type === 'file') {
        win.webContents.send('AGANI::show-notification', {
          title: 'Watcher I/O error',
          type: 'error',
          message: err.message
        })
        return
      }
    }
  }

  win.webContents.send(EVENT_NAME[type], {
    type: 'add',
    change: file
  })
}

const unlink = (win, pathname, type) => {
  const file = { pathname }
  win.webContents.send(EVENT_NAME[type], {
    type: 'unlink',
    change: file
  })
}

const change = async (win, pathname, type, endOfLine) => {
  const isMarkdown = hasMarkdownExtension(pathname)
  if (isMarkdown) {
    // HACK: Markdown data should be removed completely in #1034/#1035 and
    // should be only loaded after user interaction.
    try {
      const data = await loadMarkdownFile(pathname, endOfLine)
      const file = {
        pathname,
        data
      }
      win.webContents.send(EVENT_NAME[type], {
        type: 'change',
        change: file
      })
    } catch (err) {
      // Only notify user about opened files.
      if (type === 'file') {
        win.webContents.send('AGANI::show-notification', {
          title: 'Watcher I/O error',
          type: 'error',
          message: err.message
        })
      }
    }
  }
}

const addDir = (win, pathname, type) => {
  if (type === 'file') return

  const directory = {
    pathname,
    name: path.basename(pathname),
    isCollapsed: true,
    isDirectory: true,
    isFile: false,
    isMarkdown: false,
    folders: [],
    files: []
  }

  win.webContents.send('AGANI::update-object-tree', {
    type: 'addDir',
    change: directory
  })
}

const unlinkDir = (win, pathname, type) => {
  if (type === 'file') return

  const directory = { pathname }
  win.webContents.send('AGANI::update-object-tree', {
    type: 'unlinkDir',
    change: directory
  })
}

class Watcher {

  /**
   * @param {Preference} preferences The preference instance.
   */
  constructor (preferences) {
    this._preferences = preferences
    this.watchers = {}
  }

  // Watch a file or directory and return a unwatch function.
  watch (win, watchPath, type = 'dir'/* file or dir */) {
    const id = getUniqueId()
    const watcher = chokidar.watch(watchPath, {
      ignored: /(^|[/\\])(\..|node_modules)/,
      ignoreInitial: type === 'file',
      persistent: true,
      ignorePermissionErrors: true,

      // Just to be sure when a file is replaced with a directory don't watch recursively.
      depth: type === 'file' ? 0 : undefined,

      // Please see GH#1043
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 150
      }
    })

    let enospcReached = false
    let renameTimeout = null

    watcher
      .on('add', pathname => add(win, pathname, type, this._preferences.getPreferedEOL()))
      .on('change', pathname => change(win, pathname, type, this._preferences.getPreferedEOL()))
      .on('unlink', pathname => unlink(win, pathname, type))
      .on('addDir', pathname => addDir(win, pathname, type))
      .on('unlinkDir', pathname => unlinkDir(win, pathname, type))
      .on('raw', (event, subpath, details) => {
        if (global.MARKTEXT_DEBUG_VERBOSE >= 3) {
          console.log('watcher: ', event, subpath, details)
        }

        // Fix atomic rename on Linux (chokidar#591).
        // TODO: This should also apply to macOS.
        // TODO: Do we need to rewatch when the watched directory was renamed?
        if (isLinux && type === 'file' && event === 'rename') {
          clearTimeout(renameTimeout)
          renameTimeout = setTimeout(async () => {
            const fileExists = await exists(watchPath)
            if (fileExists) {
              // File still exists but we need to rewatch the file because the inode has changed.
              watcher.unwatch(watchPath)
              watcher.add(watchPath)
            }
            renameTimeout = null
          }, 150)
        }
      })
      .on('error', error => {
        // Check if too many file descriptors are opened and notify the user about this issue.
        if (error.code === 'ENOSPC') {
          if (!enospcReached) {
            enospcReached = true
            log.warn('inotify limit reached: Too many file descriptors are opened.')

            win.webContents.send('AGANI::show-notification', {
              title: 'inotify limit reached',
              type: 'warning',
              message: 'Cannot watch all files and file changes because too many file descriptors are opened.'
            })
          }
        } else {
          log.error(error)
        }
      })

    const closeFn = () => {
      if (this.watchers[id]) {
        delete this.watchers[id]
      }
      clearTimeout(renameTimeout)
      renameTimeout = null
      watcher.close()
    }

    this.watchers[id] = {
      win,
      watcher,
      pathname: watchPath,
      type,

      close: closeFn
    }

    // unwatcher function
    return closeFn
  }

  // Remove a single watcher.
  unwatch (win, watchPath, type = 'dir') {
    for (const id of Object.keys(this.watchers)) {
      const w = this.watchers[id]
      if (
        w.win === win &&
        w.pathname === watchPath &&
        w.type === type
      ) {
        w.watcher.close()
        delete this.watchers[id]
        break
      }
    }
  }

  // Remove all watchers from the given window id.
  unwatchByWindowId (windowId) {
    const watchers = []
    const watchIds = []
    for (const id of Object.keys(this.watchers)) {
      const w = this.watchers[id]
      if (w.win.id === windowId) {
        watchers.push(w.watcher)
        watchIds.push(id)
      }
    }
    if (watchers.length) {
      watchIds.forEach(id => delete this.watchers[id])
      watchers.forEach(watcher => watcher.close())
    }
  }

  close () {
    Object.keys(this.watchers).forEach(id => this.watchers[id].close())
    this.watchers = {}
  }
}

export default Watcher
