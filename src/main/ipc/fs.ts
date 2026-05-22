import fs from 'fs-extra'
import { statSync, constants, type Stats } from 'fs'
import { ipcMain } from 'electron'
import { isFile as commonIsFile, isDirectory as commonIsDirectory } from 'common/filesystem'

interface SerializedStat {
  size: number
  mtimeMs: number
  ctimeMs: number
  isFile: boolean
  isDirectory: boolean
  isSymbolicLink: boolean
}

const serializeStat = (stats: Stats): SerializedStat => ({
  size: stats.size,
  mtimeMs: stats.mtimeMs,
  ctimeMs: stats.ctimeMs,
  isFile: stats.isFile(),
  isDirectory: stats.isDirectory(),
  isSymbolicLink: stats.isSymbolicLink()
})

const toBuffer = (data: unknown): unknown => {
  if (data == null) return data
  if (Buffer.isBuffer(data)) return data
  if (data instanceof Uint8Array) return Buffer.from(data)
  if (typeof data === 'string') return data
  if (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: string }).type === 'Buffer' &&
    Array.isArray((data as { data?: unknown }).data)
  ) {
    return Buffer.from((data as { data: number[] }).data)
  }
  return data
}

export const registerFsHandlers = (): void => {
  ipcMain.handle('mt::fs::is-file', (_e, p: string) => commonIsFile(p))
  ipcMain.handle('mt::fs::is-directory', (_e, p: string) => commonIsDirectory(p))
  ipcMain.handle('mt::fs::empty-dir', (_e, p: string) => fs.emptyDir(p))
  ipcMain.handle('mt::fs::copy', (_e, src: string, dest: string) => fs.copy(src, dest))
  ipcMain.handle('mt::fs::ensure-dir', (_e, p: string) => fs.ensureDir(p))

  ipcMain.handle('mt::fs::output-file', (_e, p: string, data: unknown) =>
    fs.outputFile(p, toBuffer(data) as string | NodeJS.ArrayBufferView)
  )
  ipcMain.handle('mt::fs::move', (_e, src: string, dest: string) =>
    fs.move(src, dest, { overwrite: false })
  )
  ipcMain.handle('mt::fs::stat', async(_e, p: string) => serializeStat(await fs.stat(p)))

  ipcMain.handle('mt::fs::write-file', (_e, p: string, data: unknown) =>
    fs.writeFile(p, toBuffer(data) as string | NodeJS.ArrayBufferView)
  )
  ipcMain.handle('mt::fs::read-file', async(_e, p: string, encoding?: BufferEncoding) => {
    const buf = await fs.readFile(p, encoding)
    return buf
  })
  ipcMain.handle('mt::fs::path-exists', (_e, p: string) => fs.pathExists(p))
  ipcMain.handle('mt::fs::unlink', (_e, p: string) => fs.unlink(p))
  ipcMain.handle('mt::fs::readdir', (_e, p: string) => fs.readdir(p))
  ipcMain.handle('mt::fs::is-executable', (_e, p: string) => {
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
