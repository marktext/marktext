import fs from 'fs-extra'
import { statSync, constants } from 'fs'
import { ipcMain } from 'electron'
import {
  isFile as commonIsFile,
  isDirectory as commonIsDirectory
} from 'common/filesystem'

const serializeStat = (stats) => ({
  size: stats.size,
  mtimeMs: stats.mtimeMs,
  ctimeMs: stats.ctimeMs,
  isFile: stats.isFile(),
  isDirectory: stats.isDirectory(),
  isSymbolicLink: stats.isSymbolicLink()
})

const toBuffer = (data) => {
  if (data == null) return data
  if (Buffer.isBuffer(data)) return data
  if (data instanceof Uint8Array) return Buffer.from(data)
  if (typeof data === 'string') return data
  if (data?.type === 'Buffer' && Array.isArray(data.data)) return Buffer.from(data.data)
  return data
}

export const registerFsHandlers = () => {
  ipcMain.handle('mt::fs::is-file', (_e, p) => commonIsFile(p))
  ipcMain.handle('mt::fs::is-directory', (_e, p) => commonIsDirectory(p))
  ipcMain.handle('mt::fs::empty-dir', (_e, p) => fs.emptyDir(p))
  ipcMain.handle('mt::fs::copy', (_e, src, dest) => fs.copy(src, dest))
  ipcMain.handle('mt::fs::ensure-dir', (_e, p) => fs.ensureDir(p))
  ipcMain.handle('mt::fs::output-file', (_e, p, data) => fs.outputFile(p, toBuffer(data)))
  ipcMain.handle('mt::fs::move', (_e, src, dest) => fs.move(src, dest, { overwrite: false }))
  ipcMain.handle('mt::fs::stat', async(_e, p) => serializeStat(await fs.stat(p)))
  ipcMain.handle('mt::fs::write-file', (_e, p, data) => fs.writeFile(p, toBuffer(data)))
  ipcMain.handle('mt::fs::read-file', async(_e, p, encoding) => {
    const buf = await fs.readFile(p, encoding)
    return buf
  })
  ipcMain.handle('mt::fs::path-exists', (_e, p) => fs.pathExists(p))
  ipcMain.handle('mt::fs::unlink', (_e, p) => fs.unlink(p))
  ipcMain.handle('mt::fs::readdir', (_e, p) => fs.readdir(p))
  ipcMain.handle('mt::fs::is-executable', (_e, p) => {
    try {
      const stat = statSync(p)
      if (process.platform === 'win32') return stat.isFile()
      return (
        stat.isFile() &&
        (stat.mode & (constants.S_IXUSR | constants.S_IXGRP | constants.S_IXOTH)) !== 0
      )
    } catch {
      return false
    }
  })
}
