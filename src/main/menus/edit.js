import * as actions from '../actions/edit'
import userPreference from '../preference'

const { aidou } = userPreference.getAll()

export default {
  label: 'Edit',
  submenu: [{
    label: 'Undo',
    accelerator: 'CmdOrCtrl+Z',
    click: (menuItem, browserWindow) => {
      actions.edit(browserWindow, 'undo')
    }
  }, {
    label: 'Redo',
    accelerator: 'Shift+CmdOrCtrl+Z',
    click: (menuItem, browserWindow) => {
      actions.edit(browserWindow, 'redo')
    }
  }, {
    type: 'separator'
  }, {
    label: 'Cut',
    accelerator: 'CmdOrCtrl+X',
    role: 'cut'
  }, {
    label: 'Copy',
    accelerator: 'CmdOrCtrl+C',
    role: 'copy'
  }, {
    label: 'Paste',
    accelerator: 'CmdOrCtrl+V',
    role: 'paste'
  }, {
    type: 'separator'
  }, {
    label: 'Copy As Markdown',
    accelerator: 'Shift+CmdOrCtrl+C',
    click (menuItem, browserWindow) {
      actions.edit(browserWindow, 'copyAsMarkdown')
    }
  }, {
    label: 'Copy As HTML',
    click (menuItem, browserWindow) {
      actions.edit(browserWindow, 'copyAsHtml')
    }
  }, {
    label: 'Paste As Plain Text',
    accelerator: 'Shift+CmdOrCtrl+V',
    click (menuItem, browserWindow) {
      actions.edit(browserWindow, 'pasteAsPlainText')
    }
  }, {
    type: 'separator'
  }, {
    label: 'Select All',
    accelerator: 'CmdOrCtrl+A',
    role: 'selectall'
  }, {
    type: 'separator'
  }, {
    label: 'Find',
    accelerator: 'CmdOrCtrl+F',
    click (menuItem, browserWindow) {
      actions.edit(browserWindow, 'find')
    }
  }, {
    label: 'Find Next',
    accelerator: 'Alt+CmdOrCtrl+U',
    click (menuItem, browserWindow) {
      actions.edit(browserWindow, 'fineNext')
    }
  }, {
    label: 'Find Previous',
    accelerator: 'Shift+CmdOrCtrl+U',
    click (menuItem, browserWindow) {
      actions.edit(browserWindow, 'findPrev')
    }
  }, {
    label: 'Replace',
    accelerator: 'Alt+CmdOrCtrl+F',
    click (menuItem, browserWindow) {
      actions.edit(browserWindow, 'replace')
    }
  }, {
    type: 'separator'
  }, {
    label: 'Aidou',
    visible: aidou,
    accelerator: 'CmdOrCtrl+/',
    click (menuItem, browserWindow) {
      actions.edit(browserWindow, 'aidou')
    }
  }, {
    label: 'Insert Image',
    submenu: [{
      label: 'Absolute Path',
      click (menuItem, browserWindow) {
        actions.insertImage(browserWindow, 'absolute')
      }
    }, {
      label: 'Relative Path',
      click (menuItem, browserWindow) {
        actions.insertImage(browserWindow, 'relative')
      }
    }, {
      label: 'Upload to Cloud (EXP)',
      click (menuItem, browserWindow) {
        actions.insertImage(browserWindow, 'upload')
      }
    }]
  }, {
    type: 'separator'
  }, {
    label: 'Line Ending',
    submenu: [{
      id: 'crlfLineEndingMenuEntry',
      label: 'Carriage return and line feed (CRLF)',
      type: 'radio',
      click (menuItem, browserWindow) {
        actions.lineEnding(browserWindow, 'crlf')
      }
    }, {
      id: 'lfLineEndingMenuEntry',
      label: 'Line feed (LF)',
      type: 'radio',
      click (menuItem, browserWindow) {
        actions.lineEnding(browserWindow, 'lf')
      }
    }]
  }]
}
