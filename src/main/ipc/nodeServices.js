import { ipcMain, BrowserWindow, Menu, MenuItem, clipboard } from 'electron'
import { execFile, spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'
import log from 'electron-log'
import { getFonts } from 'font-list'
import commandExists from 'command-exists'
import { rgPath as bundledRgPath } from '@vscode/ripgrep'
import { isChildOfDirectory } from 'common/filesystem/paths'

const resolvedRgPath = (process.env.MARKTEXT_RIPGREP_PATH || bundledRgPath).replace(/\bapp\.asar\b/, 'app.asar.unpacked')

const activeSearches = new Map()

function getUploadPathEnv () {
  const extras = process.platform === 'darwin'
    ? ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin']
    : process.platform === 'linux'
      ? ['/usr/local/bin', '/usr/bin', '/bin']
      : []
  const cur = (process.env.PATH || '').split(path.delimiter)
  const merged = [...cur]
  for (const p of extras) {
    if (p && !merged.includes(p)) merged.push(p)
  }
  return merged.filter(Boolean).join(path.delimiter)
}

function resolvePicgoBinary () {
  const candidates = process.platform === 'win32'
    ? ['picgo', 'picgo.exe']
    : [
        'picgo',
        '/opt/homebrew/bin/picgo',
        '/usr/local/bin/picgo',
        '/usr/bin/picgo',
        `${process.env.HOME}/.npm-global/bin/picgo`,
        `${process.env.HOME}/.npm/bin/picgo`,
        '/usr/local/lib/node_modules/.bin/picgo'
      ]
  for (const c of candidates) {
    try {
      if (commandExists.sync(c)) return c
    } catch {}
    if (c.startsWith('/') && fs.existsSync(c)) return c
  }
  return null
}

function isPathAllowed (event, targetPath, accessor) {
  if (!targetPath || typeof targetPath !== 'string') return false
  const resolved = path.resolve(targetPath)

  const userDataPath = accessor.paths.userDataPath
  const tmpDir = os.tmpdir()
  if (isChildOfDirectory(userDataPath, resolved)) return true
  if (isChildOfDirectory(tmpDir, resolved)) return true

  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) {
    const editorWin = accessor.windowManager.get(win.id)
    if (editorWin) {
      const rootDir = editorWin.openedRootDirectory
      if (rootDir && isChildOfDirectory(rootDir, resolved)) return true
      const openedFiles = editorWin._openedFiles || []
      for (const f of openedFiles) {
        if (path.resolve(f.pathname || f) === resolved) return true
        if (isChildOfDirectory(path.dirname(f.pathname || f), resolved)) return true
      }
    }
  }
  return false
}

export function registerNodeServiceHandlers (accessor) {
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

  ipcMain.on('mt::window-set-fullscreen', (event, flag) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.setFullScreen(!!flag)
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
          label: String(item.label ?? ''),
          type: ['normal', 'separator', 'checkbox', 'radio'].includes(item.type) ? item.type : 'normal',
          enabled: item.enabled !== false,
          checked: !!item.checked,
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
    return getFonts()
  })

  // Execute upload command (picgo or CLI script)
  ipcMain.handle('mt::exec-upload', (event, { uploader, imagePath, cliScript }) => {
    return new Promise((resolve, reject) => {
      const env = { ...process.env, PATH: getUploadPathEnv() }

      let binary
      let args
      if (uploader === 'picgo') {
        binary = resolvePicgoBinary()
        if (!binary) return reject('PicGo command not found in PATH')
        args = ['u', imagePath]
      } else if (uploader === 'cliScript') {
        if (!cliScript || !fs.existsSync(cliScript)) {
          return reject('CLI script path does not exist')
        }
        try {
          const stat = fs.statSync(cliScript)
          const isExec = process.platform === 'win32'
            ? stat.isFile()
            : stat.isFile() && (stat.mode & (fs.constants.S_IXUSR | fs.constants.S_IXGRP | fs.constants.S_IXOTH)) !== 0
          if (!isExec) return reject('CLI script is not executable')
        } catch {
          return reject('Cannot verify CLI script')
        }
        binary = cliScript
        args = [imagePath]
      } else {
        return reject('Unknown uploader: ' + uploader)
      }

      execFile(binary, args, { env }, (err, stdout, stderr) => {
        if (err) return reject(err.message)
        resolve({ stdout, stderr })
      })
    })
  })

  // Read directory contents
  ipcMain.handle('mt::read-dir-sync', (event, dirPath) => {
    if (!isPathAllowed(event, dirPath, accessor)) {
      log.warn('Blocked directory read outside allowed scope:', dirPath)
      return []
    }
    try {
      return fs.readdirSync(dirPath)
    } catch {
      return []
    }
  })

  // Read file (text)
  ipcMain.handle('mt::read-file-text', (event, filePath, encoding) => {
    if (!isPathAllowed(event, filePath, accessor)) {
      log.warn('Blocked file read outside allowed scope:', filePath)
      return null
    }
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
  ipcMain.handle('mt::ripgrep-search', (event, { directories, pattern, options }) => {
    const sender = event.sender
    const searchId = Date.now() + Math.random()

    const runSearch = () => {
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
            child = spawn(resolvedRgPath, args, { cwd: directoryPath, stdio: ['pipe', 'pipe', 'pipe'] })
          } catch (err) {
            return reject(err)
          }

          activeSearches.set(searchId, child)

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
            activeSearches.delete(searchId)
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

      Promise.all(allPromises).then(() => {
        if (!sender.isDestroyed()) {
          sender.send('mt::ripgrep-search-done', { searchId })
        }
      }).catch((err) => {
        log.warn('Ripgrep search failed:', err)
        if (!sender.isDestroyed()) {
          sender.send('mt::ripgrep-search-done', { searchId, error: err.message })
        }
      })
    }

    runSearch()
    return searchId
  })

  // Ripgrep file search
  ipcMain.handle('mt::ripgrep-file-search', (event, { directoryPath, options, searchId: clientSearchId }) => {
    const searchId = clientSearchId || (Date.now() + Math.random())
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
        child = spawn(resolvedRgPath, args, { cwd: directoryPath, stdio: ['pipe', 'pipe', 'pipe'] })
      } catch (err) {
        return reject(err)
      }

      activeSearches.set(searchId, child)

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
        activeSearches.delete(searchId)
        if (buffer) results.push(buffer)
        if (code !== null && code > 1) {
          reject(new Error(bufferError))
        } else {
          resolve({ results, searchId })
        }
      })

      child.on('error', reject)
    })
  })

  // Cancel a ripgrep search
  ipcMain.on('mt::ripgrep-cancel', (event, searchId) => {
    const child = activeSearches.get(searchId)
    if (child) {
      child.kill()
      activeSearches.delete(searchId)
    }
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
