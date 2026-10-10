import path from 'path'
import { dialog, shell } from 'electron'
import type { BrowserWindow } from 'electron'
import { t } from '../i18n'
import { toNativePath } from 'common/filesystem/paths'

// A destructive action must not be the default button, so cancel doubles as
// `defaultId` and `cancelId` (Esc cancels).
const CONFIRM_BUTTON_ID = 0
const CANCEL_BUTTON_ID = 1

/** Asks first; returns true only when the item was actually trashed. */
export const confirmAndTrashItem = async(
  win: BrowserWindow | null,
  fullPath: string
): Promise<boolean> => {
  const nativePath = toNativePath(fullPath)
  const options = {
    type: 'warning' as const,
    buttons: [t('contextMenu.sideBar.moveToTrash'), t('dialog.cancel')],
    defaultId: CANCEL_BUTTON_ID,
    cancelId: CANCEL_BUTTON_ID,
    noLink: true,
    message: t('dialog.moveToTrash', { name: path.basename(nativePath) })
  }
  const { response } = win
    ? await dialog.showMessageBox(win, options)
    : await dialog.showMessageBox(options)

  if (response !== CONFIRM_BUTTON_ID) return false
  await shell.trashItem(nativePath)
  return true
}
