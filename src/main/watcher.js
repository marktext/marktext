import path from 'path'
import fs from 'fs'
import { promisify } from 'util'
import chokidar from 'chokidar'
import { getUniqueId, log, hasMarkdownExtension } from './utils'
import { loadMarkdownFile } from './utils/filesystem'

const add = async (win, pathname) => {
  const stats = await promisify(fs.stat)(pathname)
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
    const data = await loadMarkdownFile(pathname)
    file.data = data
  }

  win.webContents.send('AGANI::update-object-tree', {
    type: 'add',
    change: file
  })
}

const unlink = (win, pathname) => {
  const file = { pathname }
  win.webContents.send('AGANI::update-object-tree', {
    type: 'unlink',
    change: file
  })
}

const change = async (win, pathname) => {
  const isMarkdown = hasMarkdownExtension(pathname)

  if (isMarkdown) {
    const data = await loadMarkdownFile(pathname)
    const file = {
      pathname,
      data
    }
    win.webContents.send('AGANI::update-object-tree', {
      type: 'change',
      change: file
    })
  }
}

const addDir = (win, pathname) => {
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

const unlinkDir = (win, pathname) => {
  const directory = { pathname }
  win.webContents.send('AGANI::update-object-tree', {
    type: 'unlinkDir',
    change: directory
  })
}

class Watcher {
  constructor () {
    this.watchers = {}
  }
  // return a unwatch function
  watch (win, dir) {
    const id = getUniqueId()
    const watcher = chokidar.watch(dir, {
      ignored: /node_modules|\.git/,
      ignoreInitial: false,
      persistent: true
    })

    watcher
      .on('add', pathname => add(win, pathname))
      .on('change', pathname => change(win, pathname))
      .on('unlink', pathname => unlink(win, pathname))
      .on('addDir', pathname => addDir(win, pathname))
      .on('unlinkDir', pathname => unlinkDir(win, pathname))
      .on('error', error => {
        log(`Watcher error: ${error}`)
      })

    this.watchers[id] = {
      win,
      watcher
    }

    // unwatcher function
    return () => {
      if (this.watchers[id]) {
        delete this.watchers[id]
      }
      watcher.close()
    }
  }

  clear () {
    Object.keys(this.watchers).forEach(id => this.watchers[id].watcher.close())
  }
}

export default Watcher
