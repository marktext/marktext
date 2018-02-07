import * as actions from '../actions/paragraph'

export default {
  label: 'Paragraph',
  submenu: [{
    label: 'Heading 1',
    accelerator: 'CmdOrCtrl+1',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'heading 1')
    }
  }, {
    label: 'Heading 2',
    accelerator: 'CmdOrCtrl+2',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'heading 2')
    }
  }, {
    label: 'Heading 3',
    accelerator: 'CmdOrCtrl+3',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'heading 3')
    }
  }, {
    label: 'Heading 4',
    accelerator: 'CmdOrCtrl+4',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'heading 4')
    }
  }, {
    label: 'Heading 5',
    accelerator: 'CmdOrCtrl+5',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'heading 5')
    }
  }, {
    label: 'Heading 6',
    accelerator: 'CmdOrCtrl+6',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'heading 6')
    }
  }, {
    type: 'separator'
  }, {
    label: 'Upgrade Heading',
    accelerator: 'CmdOrCtrl+=',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'upgrade heading')
    }
  }, {
    label: 'Degrade Heading',
    accelerator: 'CmdOrCtrl+-',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'degrade heading')
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
    label: 'Paragraph',
    accelerator: 'CmdOrCtrl+0',
    click: function (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'paragraph')
    }
  }, {
    label: 'Horizontal Line',
    accelerator: 'Option+CmdOrCtrl+-',
    click: function (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'hr')
    }
  }]
}
