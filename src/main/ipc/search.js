import { ipcMain, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import path from 'path'
import log from 'electron-log'
import { rgPath as bundledRgPath } from '@vscode/ripgrep'
import { isChildOfDirectory } from 'common/filesystem/paths'

const resolvedRgPath = (process.env.MARKTEXT_RIPGREP_PATH || bundledRgPath).replace(/\bapp\.asar\b/, 'app.asar.unpacked')

const activeSearches = new Map()

function prepareGlobs(globs, projectRootPath) {
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

export function registerSearchHandlers(accessor) {
  ipcMain.handle('mt::ripgrep-search', (event, { directories, pattern, options, searchId: clientSearchId }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const editorWin = win ? accessor.windowManager.get(win.id) : null
    const rootDir = editorWin ? editorWin.openedRootDirectory : null

    for (const dir of directories) {
      const resolved = path.resolve(dir)
      if (!rootDir || !isChildOfDirectory(rootDir, resolved)) {
        log.warn('Blocked ripgrep search outside project scope:', dir)
        return null
      }
    }

    const sender = event.sender
    const searchId = clientSearchId || (Date.now() + Math.random())

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

  ipcMain.handle('mt::ripgrep-file-search', (event, { directoryPath, options, searchId: clientSearchId }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const editorWin = win ? accessor.windowManager.get(win.id) : null
    const rootDir = editorWin ? editorWin.openedRootDirectory : null
    const resolved = path.resolve(directoryPath)

    if (!rootDir || !isChildOfDirectory(rootDir, resolved)) {
      log.warn('Blocked ripgrep file search outside project scope:', directoryPath)
      return Promise.resolve({ results: [], searchId: clientSearchId })
    }

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

  ipcMain.on('mt::ripgrep-cancel', (event, searchId) => {
    const child = activeSearches.get(searchId)
    if (child) {
      child.kill()
      activeSearches.delete(searchId)
    }
  })
}
