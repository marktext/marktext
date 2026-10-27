import { ipcMain, shell, clipboard } from 'electron'
import log from 'electron-log'
import { fileURLToPath } from 'url'
import type { ClipboardImageWriteOptions } from '@shared/types/ipc'
import { writeClipboardImage } from './clipboardImage'

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

  ipcMain.handle('mt::clipboard::write-text', async(_e, text: string) => {
    try {
      await clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  })
  ipcMain.handle(
    'mt::clipboard::write-image',
    async(event, png: Uint8Array, options?: ClipboardImageWriteOptions) => {
      try {
        return await writeClipboardImage(event.sender.id, png, options)
      } catch (err) {
        log.error('clipboard.write failed:', err)
        return false
      }
    }
  )

  ipcMain.handle('mt::clipboard::read-text', async() => {
    try {
      return await clipboard.readText()
    } catch {
      return ''
    }
  })

  ipcMain.handle('mt::clipboard::guess-file-path', async() => {
    try {
      // Electron maps native file references to this MIME type on all platforms.
      const items = await clipboard.read()
      for (const item of items) {
        if (!item.types.includes('text/uri-list')) continue
        const blob = await item.getType('text/uri-list')
        const uri = (await blob.text()).split(/\r?\n/).find((line) => /^file:\/\//i.test(line))
        if (uri) {
          return fileURLToPath(uri)
        }
      }
      return ''
    } catch (err) {
      log.error('clipboard.guess-file-path failed:', err)
      return ''
    }
  })
}
