import { ipcMain, clipboard } from 'electron'

export function registerClipboardHandlers() {
  ipcMain.handle('mt::clipboard-guess-filepath', () => {
    if (process.platform === 'darwin') {
      if (clipboard.has('NSFilenamesPboardType')) {
        const rawData = clipboard.read('NSFilenamesPboardType')
        const filePaths = rawData.match(/<string>([\s\S]+?)<\/string>/g)
        if (filePaths) {
          return filePaths.map(s =>
            s.replace(/<\/?string>/g, '')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
          )
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
}
