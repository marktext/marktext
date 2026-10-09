import { ipcMain, shell, clipboard, nativeImage, ClipboardItem } from 'electron'
import log from 'electron-log'
import { readClipboardFilePath } from '../utils/clipboard'

export const registerShellHandlers = (): void => {
  ipcMain.handle('mt::shell::open-external', async(_e, url: string) => {
    try {
      await shell.openExternal(url)
      return true
    } catch (err) {
      log.error('shell.openExternal failed:', err)
      return false
    }
  })
  ipcMain.on('mt::shell::open-external', (_e, url: string) => {
    shell.openExternal(url).catch((err) => log.error('shell.openExternal failed:', err))
  })
  ipcMain.on('mt::shell::show-item', (_e, fullPath: string) => {
    try {
      shell.showItemInFolder(fullPath)
    } catch (err) {
      log.error('shell.showItemInFolder failed:', err)
    }
  })
  ipcMain.handle('mt::shell::open-path', async(_e, fullPath: string) => {
    try {
      return await shell.openPath(fullPath)
    } catch (err) {
      log.error('shell.openPath failed:', err)
      return String(err instanceof Error ? err.message : err)
    }
  })

  ipcMain.on('mt::clipboard::write-text', (_e, text: string) => {
    clipboard.writeText(text).catch((err) => log.error('clipboard.writeText failed:', err))
  })
  ipcMain.handle('mt::clipboard::write-image', async(_e, png: Uint8Array) => {
    try {
      const image = nativeImage.createFromBuffer(Buffer.from(png))
      if (image.isEmpty()) return false
      await clipboard.write([
        new ClipboardItem({
          'image/png': new Blob([new Uint8Array(image.toPNG())], { type: 'image/png' })
        })
      ])
      return true
    } catch (err) {
      log.error('clipboard.writeImage failed:', err)
      return false
    }
  })

  ipcMain.handle('mt::clipboard::read-text', async() => {
    try {
      return await clipboard.readText()
    } catch {
      return ''
    }
  })

  ipcMain.handle('mt::clipboard::guess-file-path', async() => {
    return (await readClipboardFilePath()) ?? ''
  })
}
