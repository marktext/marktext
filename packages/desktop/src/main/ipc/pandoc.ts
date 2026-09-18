import { BrowserWindow, dialog, ipcMain } from 'electron'
import pandoc from '../utils/pandoc'
import type { PandocCheckResult } from '@shared/pandoc'
import type { PandocPickerKind } from '@shared/types/ipc'

/**
 * What the preferences page can ask the operating system to pick.
 *
 * `executable` is the pandoc binary itself, `folder` the fixed export
 * destination and `reference-doc` the Word template used for the style of
 * docx/odt exports.
 */
const PICKER_FILTERS: Record<PandocPickerKind, Electron.FileFilter[] | undefined> = {
  executable: [
    // pandoc ships a single .exe on Windows; elsewhere it has no extension at
    // all, which a filter cannot express — hence `undefined` (no filter) below.
    { name: 'Executable', extensions: ['exe', 'cmd', 'bat'] }
  ],
  folder: undefined,
  'reference-doc': [
    {
      name: 'Reference document',
      extensions: ['docx', 'dotx', 'odt', 'ott']
    }
  ]
}

export const registerPandocHandlers = (): void => {
  // `command` is what the user typed, so an empty string means "check whatever
  // an export would use" rather than "check nothing".
  ipcMain.handle('mt::pandoc::check', (_e, command: string): Promise<PandocCheckResult> =>
    pandoc.check(command)
  )

  ipcMain.handle(
    'mt::pandoc::pick-path',
    async(e, kind: PandocPickerKind, defaultPath?: string): Promise<string> => {
      const win = BrowserWindow.fromWebContents(e.sender)
      if (!win) {
        return ''
      }

      const filters = PICKER_FILTERS[kind]
      const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        defaultPath: defaultPath || undefined,
        properties: kind === 'folder' ? ['openDirectory', 'createDirectory'] : ['openFile'],
        // On macOS a filter that does not match the binary would grey it out and
        // leave the user unable to pick their pandoc at all.
        ...(kind === 'executable' && process.platform !== 'win32' ? {} : { filters })
      })

      if (canceled || !filePaths || !filePaths[0]) {
        return ''
      }
      return filePaths[0]
    }
  )
}
