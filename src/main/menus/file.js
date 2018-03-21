import * as actions from '../actions/file'
import { getUserPreference } from '../utils'

const { autoSave } = getUserPreference()

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
  }]
}
