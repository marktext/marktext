import * as actions from '../actions/paragraph'

export default {
  label: 'Paragraph',
  submenu: [{
    label: 'Heading 1',
    accelerator: 'CmdOrCtrl+1',
    click (menuItem, browserWindow) {
      // actions.newFile()
    }
  }, {
    label: 'Heading 2',
    accelerator: 'CmdOrCtrl+2',
    click (menuItem, browserWindow) {
      // actions.newFile()
    }
  }, {
    label: 'Heading 3',
    accelerator: 'CmdOrCtrl+3',
    click (menuItem, browserWindow) {
      // actions.newFile()
    }
  }, {
    label: 'Heading 4',
    accelerator: 'CmdOrCtrl+4',
    click (menuItem, browserWindow) {
      // actions.newFile()
    }
  }, {
    label: 'Heading 5',
    accelerator: 'CmdOrCtrl+5',
    click (menuItem, browserWindow) {
      // actions.newFile()
    }
  }, {
    label: 'Heading 6',
    accelerator: 'CmdOrCtrl+6',
    click (menuItem, browserWindow) {
      // actions.newFile()
    }
  }, {
    type: 'separator'
  }, {
    label: 'Upgrade Heading Level',
    accelerator: 'CmdOrCtrl+=',
    click (menuItem, browserWindow) {
      // actions.save(browserWindow)
    }
  }, {
    label: 'Degrade Heading Level',
    accelerator: 'CmdOrCtrl+-',
    click (menuItem, browserWindow) {
      // actions.saveAs(browserWindow)
    }
  }, {
    type: 'separator'
  }, {
    label: 'Table',
    accelerator: 'CmdOrCtrl+T',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'table')
    }
  }, {
    label: 'Code Fences',
    accelerator: 'Option+CmdOrCtrl+C',
    click (menuItem, browserWindow) {
      //
    }
  }, {
    type: 'separator'
  }, {
    label: 'Print',
    accelerator: 'CmdOrCtrl+P',
    click: function () {}
  }]
}
