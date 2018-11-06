import * as actions from '../actions/paragraph'
import keybindings from '../shortcutHandler'

export default {
  id: 'paragraphMenuEntry',
  label: 'Paragraph',
  submenu: [{
    id: 'heading1MenuItem',
    label: 'Heading 1',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraphHeading1'),
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'heading 1')
    }
  }, {
    id: 'heading2MenuItem',
    label: 'Heading 2',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraphHeading2'),
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'heading 2')
    }
  }, {
    id: 'heading3MenuItem',
    label: 'Heading 3',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraphHeading3'),
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'heading 3')
    }
  }, {
    id: 'heading4MenuItem',
    label: 'Heading 4',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraphHeading4'),
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'heading 4')
    }
  }, {
    id: 'heading5MenuItem',
    label: 'Heading 5',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraphHeading5'),
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'heading 5')
    }
  }, {
    id: 'heading6MenuItem',
    label: 'Heading 6',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraphHeading6'),
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'heading 6')
    }
  }, {
    type: 'separator'
  }, {
    id: 'upgradeHeadingMenuItem',
    label: 'Upgrade Heading',
    accelerator: keybindings.getAccelerator('paragraphUpgradeHeading'),
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'upgrade heading')
    }
  }, {
    id: 'degradeHeadingMenuItem',
    label: 'Degrade Heading',
    accelerator: keybindings.getAccelerator('paragraphDegradeHeading'),
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'degrade heading')
    }
  }, {
    type: 'separator'
  }, {
    id: 'tableMenuItem',
    label: 'Table',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraphTable'),
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'table')
    }
  }, {
    id: 'codeFencesMenuItem',
    label: 'Code Fences',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraphCodeFence'),
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'pre')
    }
  }, {
    id: 'quoteBlockMenuItem',
    label: 'Quote Block',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraphQuoteBlock'),
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'blockquote')
    }
  }, {
    id: 'mathBlockMenuItem',
    label: 'Math Block',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraphMathBlock'),
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'mathblock')
    }
  }, {
    id: 'htmlBlockMenuItem',
    label: 'Html Block',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraphHtmlBlock'),
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'html')
    }
  }, {
    type: 'separator'
  }, {
    id: 'orderListMenuItem',
    label: 'Order List',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraphOrderList'),
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'ol-order')
    }
  }, {
    id: 'bulletListMenuItem',
    label: 'Bullet List',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraphBulletList'),
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'ul-bullet')
    }
  }, {
    id: 'taskListMenuItem',
    label: 'Task List',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraphTaskList'),
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'ul-task')
    }
  }, {
    type: 'separator'
  }, {
    id: 'looseListItemMenuItem',
    label: 'Loose List Item',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraphLooseListItem'),
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'loose-list-item')
    }
  }, {
    type: 'separator'
  }, {
    id: 'paragraphMenuItem',
    label: 'Paragraph',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraphParagraph'),
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'paragraph')
    }
  }, {
    id: 'horizontalLineMenuItem',
    label: 'Horizontal Line',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraphHorizontalLine'),
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'hr')
    }
  }, {
    id: 'frontMatterMenuItem',
    label: 'YAML Front Matter',
    type: 'checkbox',
    accelerator: keybindings.getAccelerator('paragraphYAMLFrontMatter'),
    click (menuItem, browserWindow) {
      actions.paragraph(browserWindow, 'front-matter')
    }
  }]
}
