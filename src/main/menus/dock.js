import { app, Menu } from 'electron'
import * as actions from '../actions/file'

const dockMenu = Menu.buildFromTemplate([{
  label: 'Open...',
  click (menuItem, browserWindow) {
    actions.open(browserWindow)
  }
}, {
  label: 'Clear Recent',
  click () {
    app.clearRecentDocuments()
  }
}])

export default dockMenu
