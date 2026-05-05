import { app, Menu } from 'electron'
import * as actions from '../actions/file'

export default function (t) {
  return Menu.buildFromTemplate([{
    label: t('menu.dock.open'),
    click (menuItem, browserWindow) {
      if (browserWindow) {
        actions.openFile(browserWindow)
      } else {
        actions.newEditorWindow()
      }
    }
  }, {
    label: t('menu.dock.clearRecent'),
    click () {
      app.clearRecentDocuments()
    }
  }])
}
