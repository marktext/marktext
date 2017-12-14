import * as actions from '../editActions'

export default {
  label: 'Edit',
  submenu: [{
    label: 'Undo',
    accelerator: 'CmdOrCtrl+Z',
    click: (menuItem, browserWindow) => {
      actions.undo(browserWindow)
    }
  }, {
    label: 'Redo',
    accelerator: 'CmdOrCtrl+Y',
    click: (menuItem, browserWindow) => {
      actions.redo(browserWindow)
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
    label: 'Select All',
    accelerator: 'CmdOrCtrl+A',
    role: 'selectall'
  }]
}
