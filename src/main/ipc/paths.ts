import { ipcMain } from 'electron'
import { isSamePathSync, isImageFile } from 'common/filesystem/paths'

export const registerPathHandlers = (): void => {
  // The renderer's preload computes isChildOfDirectory / hasMarkdownExtension
  // locally (pure string ops, no IPC). Only `is-same-sync` and `is-image`
  // require fs in the rare case-insensitive / image-file path checks.
  ipcMain.on('mt::paths::is-same-sync', (event, a: string, b: string) => {
    event.returnValue = isSamePathSync(a, b, true)
  })
  ipcMain.handle('mt::paths::is-image', (_e, p: string) => isImageFile(p))
}
