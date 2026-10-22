import { ipcMain } from 'electron'
import { isSamePathSync, isImageFile } from 'common/filesystem/paths'

export const registerPathHandlers = (): void => {
  // Only filesystem-backed predicates need IPC; pure path checks stay in preload.
  ipcMain.on('mt::paths::is-same-sync', (event, a: string, b: string) => {
    event.returnValue = isSamePathSync(a, b, true)
  })
  ipcMain.handle('mt::paths::is-image', (_e, p: string) => isImageFile(p))
}
