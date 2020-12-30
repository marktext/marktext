import * as actions from '../actions/paragraph'

export default function (keybindings) {
  return {
    id: 'paragraphMenuEntry',
    label: '&Paragraph',
    submenu: [{
      id: 'heading1MenuItem',
      label: 'Heading 1',
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.heading-1'),
      click (menuItem, browserWindow) {
        actions.paragraph(browserWindow, 'heading 1')
      }
    }, {
      id: 'heading2MenuItem',
      label: 'Heading 2',
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.heading-2'),
      click (menuItem, browserWindow) {
        actions.paragraph(browserWindow, 'heading 2')
      }
    }, {
      id: 'heading3MenuItem',
      label: 'Heading 3',
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.heading-3'),
      click (menuItem, browserWindow) {
        actions.paragraph(browserWindow, 'heading 3')
      }
    }, {
      id: 'heading4MenuItem',
      label: 'Heading 4',
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.heading-4'),
      click (menuItem, browserWindow) {
        actions.paragraph(browserWindow, 'heading 4')
      }
    }, {
      id: 'heading5MenuItem',
      label: 'Heading 5',
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.heading-5'),
      click (menuItem, browserWindow) {
        actions.paragraph(browserWindow, 'heading 5')
      }
    }, {
      id: 'heading6MenuItem',
      label: 'Heading 6',
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.heading-6'),
      click (menuItem, browserWindow) {
        actions.paragraph(browserWindow, 'heading 6')
      }
    }, {
      type: 'separator'
    }, {
      id: 'upgradeHeadingMenuItem',
      label: 'Promote Heading',
      accelerator: keybindings.getAccelerator('paragraph.upgrade-heading'),
      click (menuItem, browserWindow) {
        actions.paragraph(browserWindow, 'upgrade heading')
      }
    }, {
      id: 'degradeHeadingMenuItem',
      label: 'Demote Heading',
      accelerator: keybindings.getAccelerator('paragraph.degrade-heading'),
      click (menuItem, browserWindow) {
        actions.paragraph(browserWindow, 'degrade heading')
      }
    }, {
      type: 'separator'
    }, {
      id: 'tableMenuItem',
      label: 'Table',
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.table'),
      click (menuItem, browserWindow) {
        actions.paragraph(browserWindow, 'table')
      }
    }, {
      id: 'codeFencesMenuItem',
      label: 'Code Fences',
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.code-fence'),
      click (menuItem, browserWindow) {
        actions.paragraph(browserWindow, 'pre')
      }
    }, {
      id: 'quoteBlockMenuItem',
      label: 'Quote Block',
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.quote-block'),
      click (menuItem, browserWindow) {
        actions.paragraph(browserWindow, 'blockquote')
      }
    }, {
      id: 'mathBlockMenuItem',
      label: 'Math Block',
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.math-formula'),
      click (menuItem, browserWindow) {
        actions.paragraph(browserWindow, 'mathblock')
      }
    }, {
      id: 'htmlBlockMenuItem',
      label: 'Html Block',
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.html-block'),
      click (menuItem, browserWindow) {
        actions.paragraph(browserWindow, 'html')
      }
    }, {
      type: 'separator'
    }, {
      id: 'orderListMenuItem',
      label: 'Ordered List',
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.order-list'),
      click (menuItem, browserWindow) {
        actions.paragraph(browserWindow, 'ol-order')
      }
    }, {
      id: 'bulletListMenuItem',
      label: 'Bullet List',
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.bullet-list'),
      click (menuItem, browserWindow) {
        actions.paragraph(browserWindow, 'ul-bullet')
      }
    }, {
      id: 'taskListMenuItem',
      label: 'Task List',
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.task-list'),
      click (menuItem, browserWindow) {
        actions.paragraph(browserWindow, 'ul-task')
      }
    }, {
      type: 'separator'
    }, {
      id: 'looseListItemMenuItem',
      label: 'Loose List Item',
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.loose-list-item'),
      click (menuItem, browserWindow) {
        actions.paragraph(browserWindow, 'loose-list-item')
      }
    }, {
      type: 'separator'
    }, {
      id: 'paragraphMenuItem',
      label: 'Paragraph',
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.paragraph'),
      click (menuItem, browserWindow) {
        actions.paragraph(browserWindow, 'paragraph')
      }
    }, {
      id: 'horizontalLineMenuItem',
      label: 'Horizontal Rule',
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.horizontal-line'),
      click (menuItem, browserWindow) {
        actions.paragraph(browserWindow, 'hr')
      }
    }, {
      id: 'frontMatterMenuItem',
      label: 'Front Matter',
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.front-matter'),
      click (menuItem, browserWindow) {
        actions.paragraph(browserWindow, 'front-matter')
      }
    }]
  }
}
