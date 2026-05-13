import * as actions from '../actions/paragraph'
import { t } from '../../i18n'

export default function(keybindings) {
  return {
    id: 'paragraphMenuEntry',
    label: t('menu.paragraph.title'),
    submenu: [{
      id: 'heading1MenuItem',
      label: t('menu.paragraph.heading1'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.heading-1'),
      click(menuItem, focusedWindow) {
        actions.heading1(focusedWindow)
      }
    }, {
      id: 'heading2MenuItem',
      label: t('menu.paragraph.heading2'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.heading-2'),
      click(menuItem, focusedWindow) {
        actions.heading2(focusedWindow)
      }
    }, {
      id: 'heading3MenuItem',
      label: t('menu.paragraph.heading3'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.heading-3'),
      click(menuItem, focusedWindow) {
        actions.heading3(focusedWindow)
      }
    }, {
      id: 'heading4MenuItem',
      label: t('menu.paragraph.heading4'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.heading-4'),
      click(menuItem, focusedWindow) {
        actions.heading4(focusedWindow)
      }
    }, {
      id: 'heading5MenuItem',
      label: t('menu.paragraph.heading5'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.heading-5'),
      click(menuItem, focusedWindow) {
        actions.heading5(focusedWindow)
      }
    }, {
      id: 'heading6MenuItem',
      label: t('menu.paragraph.heading6'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.heading-6'),
      click(menuItem, focusedWindow) {
        actions.heading6(focusedWindow)
      }
    }, {
      type: 'separator'
    }, {
      id: 'upgradeHeadingMenuItem',
      label: t('menu.paragraph.promoteHeading'),
      accelerator: keybindings.getAccelerator('paragraph.upgrade-heading'),
      click(menuItem, focusedWindow) {
        actions.increaseHeading(focusedWindow)
      }
    }, {
      id: 'degradeHeadingMenuItem',
      label: t('menu.paragraph.demoteHeading'),
      accelerator: keybindings.getAccelerator('paragraph.degrade-heading'),
      click(menuItem, focusedWindow) {
        actions.degradeHeading(focusedWindow)
      }
    }, {
      type: 'separator'
    }, {
      id: 'tableMenuItem',
      label: t('menu.paragraph.table'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.table'),
      click(menuItem, focusedWindow) {
        actions.table(focusedWindow)
      }
    }, {
      id: 'codeFencesMenuItem',
      label: t('menu.paragraph.codeFences'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.code-fence'),
      click(menuItem, focusedWindow) {
        actions.codeFence(focusedWindow)
      }
    }, {
      id: 'quoteBlockMenuItem',
      label: t('menu.paragraph.quoteBlock'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.quote-block'),
      click(menuItem, focusedWindow) {
        actions.quoteBlock(focusedWindow)
      }
    }, {
      id: 'mathBlockMenuItem',
      label: t('menu.paragraph.mathBlock'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.math-formula'),
      click(menuItem, focusedWindow) {
        actions.mathFormula(focusedWindow)
      }
    }, {
      id: 'htmlBlockMenuItem',
      label: t('menu.paragraph.htmlBlock'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.html-block'),
      click(menuItem, focusedWindow) {
        actions.htmlBlock(focusedWindow)
      }
    }, {
      type: 'separator'
    }, {
      id: 'orderListMenuItem',
      label: t('menu.paragraph.orderedList'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.order-list'),
      click(menuItem, focusedWindow) {
        actions.orderedList(focusedWindow)
      }
    }, {
      id: 'bulletListMenuItem',
      label: t('menu.paragraph.bulletList'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.bullet-list'),
      click(menuItem, focusedWindow) {
        actions.bulletList(focusedWindow)
      }
    }, {
      id: 'taskListMenuItem',
      label: t('menu.paragraph.taskList'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.task-list'),
      click(menuItem, focusedWindow) {
        actions.taskList(focusedWindow)
      }
    }, {
      type: 'separator'
    }, {
      id: 'looseListItemMenuItem',
      label: t('menu.paragraph.looseListItem'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.loose-list-item'),
      click(menuItem, focusedWindow) {
        actions.looseListItem(focusedWindow)
      }
    }, {
      type: 'separator'
    }, {
      id: 'paragraphMenuItem',
      label: t('menu.paragraph.paragraph'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.paragraph'),
      click(menuItem, focusedWindow) {
        actions.paragraph(focusedWindow)
      }
    }, {
      id: 'horizontalLineMenuItem',
      label: t('menu.paragraph.horizontalRule'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.horizontal-line'),
      click(menuItem, focusedWindow) {
        actions.horizontalLine(focusedWindow)
      }
    }, {
      id: 'frontMatterMenuItem',
      label: t('menu.paragraph.frontMatter'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('paragraph.front-matter'),
      click(menuItem, focusedWindow) {
        actions.frontMatter(focusedWindow)
      }
    }]
  }
}
