import { ipcMain, BrowserWindow, Menu, MenuItem, clipboard } from 'electron'
import { exec, execFile, spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import log from 'electron-log'

export function registerNodeServiceHandlers () {
  // Window control handlers
  ipcMain.on('mt::window-minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.minimize()
  })

  ipcMain.on('mt::window-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize()
      } else {
        win.maximize()
      }
    }
  })

  ipcMain.on('mt::window-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.close()
  })

  ipcMain.on('mt::window-toggle-fullscreen', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.setFullScreen(!win.isFullScreen())
  })

  ipcMain.handle('mt::window-is-fullscreen', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win ? win.isFullScreen() : false
  })

  ipcMain.handle('mt::window-is-maximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win ? win.isMaximized() : false
  })

  // Context menu handler
  ipcMain.handle('mt::show-context-menu', (event, menuTemplate) => {
    return new Promise((resolve) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      const menu = new Menu()
      for (const item of menuTemplate) {
        const menuItem = new MenuItem({
          ...item,
          click: () => resolve(item.id)
        })
        menu.append(menuItem)
      }
      menu.popup({
        window: win,
        callback: () => resolve(null)
      })
    })
  })

  // Show app menu at position
  ipcMain.on('mt::show-app-menu', (event, x, y) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const menu = Menu.getApplicationMenu()
    if (menu && win) {
      menu.popup({ window: win, x, y })
    }
  })

  // Clipboard: guess file path from system clipboard
  ipcMain.handle('mt::clipboard-guess-filepath', () => {
    if (process.platform === 'darwin') {
      if (clipboard.has('NSFilenamesPboardType')) {
        const rawData = clipboard.read('NSFilenamesPboardType')
        const filePaths = rawData.match(/<string>(.+?)<\/string>/g)
        if (filePaths) {
          return filePaths.map(s => s.replace(/<\/?string>/g, ''))
        }
      }
    } else if (process.platform === 'win32') {
      const rawData = clipboard.read('FileNameW')
      if (rawData) {
        return rawData.replace(new RegExp(String.fromCharCode(0), 'g'), '')
      }
    }
    return null
  })

  // System fonts
  ipcMain.handle('mt::get-system-fonts', async () => {
    const { getFonts } = require('font-list')
    return getFonts()
  })

  // Execute upload command (picgo or CLI script)
  ipcMain.handle('mt::exec-upload', (event, { command, args, env }) => {
    return new Promise((resolve, reject) => {
      if (args) {
        execFile(command, args, { env }, (err, stdout, stderr) => {
          if (err) return reject(err.message)
          resolve({ stdout, stderr })
        })
      } else {
        exec(command, { env }, (err, stdout, stderr) => {
          if (err) return reject(err.message)
          resolve({ stdout, stderr })
        })
      }
    })
  })

  // Read directory contents
  ipcMain.handle('mt::read-dir-sync', (event, dirPath) => {
    try {
      return fs.readdirSync(dirPath)
    } catch {
      return []
    }
  })

  // Read file (text)
  ipcMain.handle('mt::read-file-text', (event, filePath, encoding) => {
    try {
      return fs.readFileSync(filePath, encoding || 'utf8')
    } catch {
      return null
    }
  })

  // File stat and executable check
  ipcMain.handle('mt::is-file-executable', (event, filepath) => {
    try {
      const stat = fs.statSync(filepath)
      if (process.platform === 'win32') {
        return stat.isFile()
      }
      return (
        stat.isFile() &&
        (stat.mode & (fs.constants.S_IXUSR | fs.constants.S_IXGRP | fs.constants.S_IXOTH)) !== 0
      )
    } catch {
      return false
    }
  })

  // Ripgrep content search (streaming results back)
  ipcMain.handle('mt::ripgrep-search', (event, { rgPath, directories, pattern, options }) => {
    const sender = event.sender
    const searchId = Date.now() + Math.random()

    const allPromises = directories.map((directoryPath) => {
      return new Promise((resolve, reject) => {
        const args = ['--json']

        if (options.isRegexp) {
          let regexpStr = pattern
          if (regexpStr === '--') regexpStr = '\\-\\-'
          regexpStr = regexpStr.replace(/\\\//g, '/')
          args.push('--regexp', regexpStr)
          if (regexpStr.includes('\\n')) args.push('--multiline')
        } else {
          args.push('--fixed-strings')
        }

        if (options.isCaseSensitive) args.push('--case-sensitive')
        else args.push('--ignore-case')
        if (options.isWholeWord) args.push('--word-regexp')
        if (options.followSymlinks) args.push('--follow')
        if (options.maxFileSize) args.push('--max-filesize', String(options.maxFileSize))
        if (options.includeHidden) args.push('--hidden')
        if (options.noIgnore) args.push('--no-ignore')
        if (options.leadingContextLineCount) args.push('--before-context', String(options.leadingContextLineCount))
        if (options.trailingContextLineCount) args.push('--after-context', String(options.trailingContextLineCount))

        if (options.inclusions) {
          for (const glob of prepareGlobs(options.inclusions, directoryPath)) {
            args.push('--iglob', glob)
          }
        }
        if (options.exclusions) {
          for (const glob of prepareGlobs(options.exclusions, directoryPath)) {
            args.push('--iglob', '!' + glob)
          }
        }

        args.push('--')
        if (!options.isRegexp) args.push(pattern)
        args.push(directoryPath)

        let child
        try {
          child = spawn(rgPath, args, { cwd: directoryPath, stdio: ['pipe', 'pipe', 'pipe'] })
        } catch (err) {
          return reject(err)
        }

        let buffer = ''
        let bufferError = ''

        child.stdout.on('data', (chunk) => {
          buffer += chunk
          const lines = buffer.split('\n')
          buffer = lines.pop()
          for (const line of lines) {
            if (!line) continue
            if (!sender.isDestroyed()) {
              sender.send('mt::ripgrep-search-data', { searchId, line })
            }
          }
        })

        child.stderr.on('data', (chunk) => { bufferError += chunk })

        child.on('close', (code) => {
          if (buffer && !sender.isDestroyed()) {
            sender.send('mt::ripgrep-search-data', { searchId, line: buffer })
          }
          if (code !== null && code > 1 && bufferError) {
            log.warn('Ripgrep error (exit ' + code + '):', bufferError)
          }
          resolve()
        })

        child.on('error', reject)
      })
    })

    return Promise.all(allPromises).then(() => {
      if (!sender.isDestroyed()) {
        sender.send('mt::ripgrep-search-done', { searchId })
      }
      return searchId
    })
  })

  // Ripgrep file search
  ipcMain.handle('mt::ripgrep-file-search', (event, { rgPath, directoryPath, options }) => {
    return new Promise((resolve, reject) => {
      const args = ['--files']

      if (options.followSymlinks) args.push('--follow')
      if (options.includeHidden) args.push('--hidden')
      if (options.noIgnore) args.push('--no-ignore')

      if (options.inclusions) {
        for (const glob of prepareGlobs(options.inclusions, directoryPath)) {
          args.push('--iglob', glob)
        }
      }

      args.push('--')
      args.push(directoryPath)

      let child
      try {
        child = spawn(rgPath, args, { cwd: directoryPath, stdio: ['pipe', 'pipe', 'pipe'] })
      } catch (err) {
        return reject(err)
      }

      const results = []
      let buffer = ''
      let bufferError = ''

      child.stdout.on('data', (chunk) => {
        buffer += chunk
        const lines = buffer.split('\n')
        buffer = lines.pop()
        for (const line of lines) {
          if (line) results.push(line)
        }
      })

      child.stderr.on('data', (chunk) => { bufferError += chunk })

      child.on('close', (code) => {
        if (buffer) results.push(buffer)
        if (code !== null && code > 1) {
          reject(new Error(bufferError))
        } else {
          resolve(results)
        }
      })

      child.on('error', reject)
    })
  })
}

function prepareGlobs (globs, projectRootPath) {
  const output = []
  for (let pattern of globs) {
    pattern = pattern.replace(/\\/g, '/')
    if (pattern.length === 0) continue

    const projectName = path.basename(projectRootPath)
    if (pattern === projectName) {
      output.push('**/*')
      continue
    }
    if (pattern.startsWith(projectName + '/')) {
      pattern = pattern.slice(projectName.length + 1)
    }
    if (pattern.endsWith('/')) {
      pattern = pattern.slice(0, -1)
    }
    pattern = pattern.startsWith('**/') ? pattern : `**/${pattern}`
    output.push(pattern)
    output.push(pattern.endsWith('/**') ? pattern : `${pattern}/**`)
  }
  return output
}
