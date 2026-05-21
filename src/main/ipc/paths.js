import { ipcMain } from 'electron'
import {
  isChildOfDirectory,
  hasMarkdownExtension,
  isSamePathSync,
  isImageFile
} from 'common/filesystem/paths'

export const registerPathHandlers = () => {
  ipcMain.handle('mt::paths::is-child-of', (_e, dir, child) => isChildOfDirectory(dir, child))
  ipcMain.handle('mt::paths::has-md-ext', (_e, filename) => hasMarkdownExtension(filename))
  ipcMain.handle('mt::paths::is-same', (_e, a, b) => isSamePathSync(a, b))
  ipcMain.handle('mt::paths::is-image', (_e, p) => isImageFile(p))
}
