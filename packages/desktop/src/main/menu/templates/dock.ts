import { app, Menu, type BrowserWindow } from 'electron'
import * as actions from '../actions/file'
import { t } from '../../i18n'

/** macOS dock menu; rebuilt on language change so labels follow the active locale. */
export function createDockMenu(): Menu {
  return Menu.buildFromTemplate([
    {
      label: t('menu.dock.open'),
      click(_menuItem, browserWindow) {
        if (browserWindow) {
          actions.openFile(browserWindow as BrowserWindow)
        } else {
          actions.newEditorWindow()
        }
      }
    },
    {
      label: t('menu.dock.clearRecent'),
      click() {
        app.clearRecentDocuments()
      }
    }
  ])
}

export default createDockMenu
