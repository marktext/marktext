import path from 'path'
import { dialog, shell } from 'electron'
import type { BrowserWindow } from 'electron'
import { t } from '../i18n'

// A destructive action must not be the default button, so cancel doubles as
// `defaultId` and `cancelId` (Esc cancels).
const CONFIRM_BUTTON_ID = 0
const CANCEL_BUTTON_ID = 1

const pendingTrashRequests = new Map<BrowserWindow | null, Map<string, Promise<boolean>>>()

/** Asks first; returns true only when the item was actually trashed. */
const askAndTrashItem = async(
  win: BrowserWindow | null,
  fullPath: string
): Promise<boolean> => {
  const options = {
    type: 'warning' as const,
    buttons: [t('contextMenu.sideBar.moveToTrash'), t('dialog.cancel')],
    defaultId: CANCEL_BUTTON_ID,
    cancelId: CANCEL_BUTTON_ID,
    noLink: true,
    message: t('dialog.moveToTrash', { name: path.basename(fullPath) })
  }
  const { response } = win
    ? await dialog.showMessageBox(win, options)
    : await dialog.showMessageBox(options)

  if (response !== CONFIRM_BUTTON_ID) return false
  await shell.trashItem(fullPath)
  return true
}

export const confirmAndTrashItem = (
  win: BrowserWindow | null,
  fullPath: string
): Promise<boolean> => {
  const pathname = path.resolve(fullPath)
  let requests = pendingTrashRequests.get(win)
  if (!requests) {
    requests = new Map()
    pendingTrashRequests.set(win, requests)
  }
  const pending = requests.get(pathname)
  if (pending) return pending

  // Key repeats and duplicate IPC requests must share the open confirmation.
  const request = askAndTrashItem(win, pathname).finally(() => {
    requests.delete(pathname)
    if (requests.size === 0) pendingTrashRequests.delete(win)
  })
  requests.set(pathname, request)
  return request
}
