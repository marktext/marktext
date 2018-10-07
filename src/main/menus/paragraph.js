import * as actions from '../actions/paragraph'

export default {
  id: 'paragraphMenuEntry',
  label: 'Paragraph',
  submenu: [{
    id: 'heading1MenuItem',
    label: 'Heading 1',
    type: 'checkbox',
    accelerator: 'CmdOrCtrl+1',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'heading 1')
    }
  }, {
    id: 'heading2MenuItem',
    label: 'Heading 2',
    type: 'checkbox',
    accelerator: 'CmdOrCtrl+2',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'heading 2')
    }
  }, {
    id: 'heading3MenuItem',
    label: 'Heading 3',
    type: 'checkbox',
    accelerator: 'CmdOrCtrl+3',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'heading 3')
    }
  }, {
    id: 'heading4MenuItem',
    label: 'Heading 4',
    type: 'checkbox',
    accelerator: 'CmdOrCtrl+4',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'heading 4')
    }
  }, {
    id: 'heading5MenuItem',
    label: 'Heading 5',
    type: 'checkbox',
    accelerator: 'CmdOrCtrl+5',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'heading 5')
    }
  }, {
    id: 'heading6MenuItem',
    label: 'Heading 6',
    type: 'checkbox',
    accelerator: 'CmdOrCtrl+6',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'heading 6')
    }
  }, {
    type: 'separator'
  }, {
    id: 'upgradeHeadingMenuItem',
    label: 'Upgrade Heading',
    accelerator: 'CmdOrCtrl+=',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'upgrade heading')
    }
  }, {
    id: 'degradeHeadingMenuItem',
    label: 'Degrade Heading',
    accelerator: 'CmdOrCtrl+-',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'degrade heading')
    }
  }, {
    type: 'separator'
  }, {
    id: 'tableMenuItem',
    label: 'Table',
    type: 'checkbox',
    accelerator: 'CmdOrCtrl+T',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'table')
    }
  }, {
    id: 'codeFencesMenuItem',
    label: 'Code Fences',
    type: 'checkbox',
    accelerator: 'Alt+CmdOrCtrl+C',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'pre')
    }
  }, {
    id: 'quoteBlockMenuItem',
    label: 'Quote Block',
    type: 'checkbox',
    accelerator: 'Alt+CmdOrCtrl+Q',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'blockquote')
    }
  }, {
    id: 'mathBlockMenuItem',
    label: 'Math Block',
    type: 'checkbox',
    accelerator: 'Alt+CmdOrCtrl+M',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'mathblock')
    }
  }, {
    id: 'htmlBlockMenuItem',
    label: 'Html Block',
    type: 'checkbox',
    accelerator: 'Alt+CmdOrCtrl+L',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'html')
    }
  }, {
    type: 'separator'
  }, {
    id: 'orderListMenuItem',
    label: 'Order List',
    type: 'checkbox',
    accelerator: 'Alt+CmdOrCtrl+O',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'ol-order')
    }
  }, {
    id: 'bulletListMenuItem',
    label: 'Bullet List',
    type: 'checkbox',
    accelerator: 'Alt+CmdOrCtrl+U',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'ul-bullet')
    }
  }, {
    id: 'taskListMenuItem',
    label: 'Task List',
    type: 'checkbox',
    accelerator: 'Alt+CmdOrCtrl+X',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'ul-task')
    }
  }, {
    type: 'separator'
  }, {
    id: 'looseListItemMenuItem',
    label: 'Loose List Item',
    type: 'checkbox',
    accelerator: 'Alt+CmdOrCtrl+L',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'loose-list-item')
    }
  }, {
    type: 'separator'
  }, {
    id: 'paragraphMenuItem',
    label: 'Paragraph',
    type: 'checkbox',
    accelerator: 'CmdOrCtrl+0',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'paragraph')
    }
  }, {
    id: 'horizontalLineMenuItem',
    label: 'Horizontal Line',
    type: 'checkbox',
    accelerator: 'Alt+CmdOrCtrl+-',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'hr')
    }
  }, {
    id: 'frontMatterMenuItem',
    label: 'YAML Front Matter',
    type: 'checkbox',
    accelerator: 'Alt+CmdOrCtrl+Y',
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'front-matter')
    }
  }]
}
