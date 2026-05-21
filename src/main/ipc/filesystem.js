import { ipcMain, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import log from 'electron-log'
import { isChildOfDirectory } from 'common/filesystem/paths'

export function isPathAllowed(event, targetPath, accessor) {
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
      const openedFiles = editorWin.openedFiles
      for (const f of openedFiles) {
        if (path.resolve(f.pathname || f) === resolved) return true
      }
    }
  }
  return false
}

export function registerFilesystemHandlers(accessor) {
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
}
