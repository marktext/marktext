import { ipcMain } from 'electron'
import log from 'electron-log'

export const registerFontsHandlers = () => {
  ipcMain.handle('mt::fonts::list', async() => {
    try {
      const fontList = await import('font-list')
      const getFonts = fontList.getFonts || fontList.default?.getFonts
      if (typeof getFonts !== 'function') return []
      return await getFonts()
    } catch (err) {
      log.error('font-list failed:', err)
      return []
    }
  })
}
