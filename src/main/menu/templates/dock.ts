import { app, Menu, type BrowserWindow } from 'electron'
import * as actions from '../actions/file'

const dockMenu = Menu.buildFromTemplate([
  {
    label: 'Open...',
    click(_menuItem, browserWindow) {
      if (browserWindow) {
        actions.openFile(browserWindow as BrowserWindow)
      } else {
        actions.newEditorWindow()
      }
    }
  },
  {
    label: 'Clear Recent',
    click() {
      app.clearRecentDocuments()
    }
  }
])

export default dockMenu
