import { app } from 'electron'
import * as actions from '../actions/file'
import { userSetting } from '../actions/marktext'
import userPreference from '../preference'

const { autoSave } = userPreference.getAll()
const notOsx = process.platform !== 'darwin'

export default {
  label: 'File',
  submenu: [{
    label: 'New File',
    accelerator: 'CmdOrCtrl+N',
    click (menuItem, browserWindow) {
      actions.newFile()
    }
  }, {
    label: 'Open...',
    accelerator: 'CmdOrCtrl+O',
    click (menuItem, browserWindow) {
      actions.open(browserWindow)
    }
  }, {
    role: 'recentdocuments',
    submenu: [
      {
        role: 'clearrecentdocuments'
      }
    ]
  }, {
    type: 'separator'
  }, {
    label: 'Save',
    accelerator: 'CmdOrCtrl+S',
    click (menuItem, browserWindow) {
      actions.save(browserWindow)
    }
  }, {
    label: 'Save As...',
    accelerator: 'Shift+CmdOrCtrl+S',
    click (menuItem, browserWindow) {
      actions.saveAs(browserWindow)
    }
  }, {
    label: 'Auto Save',
    type: 'checkbox',
    checked: autoSave,
    click (menuItem, browserWindow) {
      actions.autoSave(menuItem, browserWindow)
    }
  }, {
    type: 'separator'
  }, {
    label: 'Move To...',
    click (menuItem, browserWindow) {
      actions.moveTo(browserWindow)
    }
  }, {
    type: 'separator'
  }, {
    label: 'Export Styled HTML',
    click (menuItem, browserWindow) {
      actions.exportFile(browserWindow, 'styledHtml')
    }
  }, {
    label: 'Export HTML',
    click (menuItem, browserWindow) {
      actions.exportFile(browserWindow, 'html')
    }
  }, {
    label: 'Export PDF',
    click (menuItem, browserWindow) {
      actions.exportFile(browserWindow, 'pdf')
    }
  }, {
    type: 'separator'
  }, {
    label: 'Print',
    accelerator: 'CmdOrCtrl+P',
    click (menuItem, browserWindow) {
      actions.print(browserWindow)
    }
  }, {
    type: 'separator',
    visible: notOsx
  }, {
    label: 'Preferences',
    accelerator: 'Ctrl+,',
    visible: notOsx,
    click (menuItem, browserWindow) {
      userSetting(menuItem, browserWindow)
    }
  }, {
    type: 'separator',
    visible: notOsx
  }, {
    label: 'Quit',
    accelerator: 'Ctrl+Q',
    visible: notOsx,
    click: app.quit
  }]
}
