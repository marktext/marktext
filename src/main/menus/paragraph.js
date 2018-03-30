import * as actions from '../actions/paragraph'

export default {
  label: 'Paragraph',
  submenu: [{
    label: 'Heading 1',
    type: 'checkbox',
    accelerator: 'CmdOrCtrl+1',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'heading 1')
    }
  }, {
    label: 'Heading 2',
    type: 'checkbox',
    accelerator: 'CmdOrCtrl+2',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'heading 2')
    }
  }, {
    label: 'Heading 3',
    type: 'checkbox',
    accelerator: 'CmdOrCtrl+3',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'heading 3')
    }
  }, {
    label: 'Heading 4',
    type: 'checkbox',
    accelerator: 'CmdOrCtrl+4',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'heading 4')
    }
  }, {
    label: 'Heading 5',
    type: 'checkbox',
    accelerator: 'CmdOrCtrl+5',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'heading 5')
    }
  }, {
    label: 'Heading 6',
    type: 'checkbox',
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
    type: 'checkbox',
    accelerator: 'CmdOrCtrl+T',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'table')
    }
  }, {
    label: 'Code Fences',
    type: 'checkbox',
    accelerator: 'Alt+CmdOrCtrl+C',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'pre')
    }
  }, {
    label: 'Quote Block',
    type: 'checkbox',
    accelerator: 'Alt+CmdOrCtrl+Q',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'blockquote')
    }
  }, {
    type: 'separator'
  }, {
    label: 'Order List',
    type: 'checkbox',
    accelerator: 'Alt+CmdOrCtrl+O',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'ol-order')
    }
  }, {
    label: 'Bullet List',
    type: 'checkbox',
    accelerator: 'Alt+CmdOrCtrl+U',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'ul-bullet')
    }
  }, {
    label: 'Task List',
    type: 'checkbox',
    accelerator: 'Alt+CmdOrCtrl+X',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'ul-task')
    }
  }, {
    type: 'separator'
  }, {
    label: 'Loose List Item',
    type: 'checkbox',
    accelerator: 'Alt+CmdOrCtrl+L',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'loose-list-item')
    }
  }, {
    type: 'separator'
  }, {
    label: 'Paragraph',
    type: 'checkbox',
    accelerator: 'CmdOrCtrl+0',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'paragraph')
    }
  }, {
    label: 'Horizontal Line',
    type: 'checkbox',
    accelerator: 'Alt+CmdOrCtrl+-',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'hr')
    }
  }]
}
