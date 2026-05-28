import { type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import * as actions from '../actions/paragraph'
import { t } from '../../i18n'
import type Keybindings from '../../keyboard/shortcutHandler'

export default function(keybindings: Keybindings): MenuItemConstructorOptions {
  return {
    id: 'paragraphMenuEntry',
    label: t('menu.paragraph.title'),
    submenu: [
      {
        id: 'heading1MenuItem',
        label: t('menu.paragraph.heading1'),
        type: 'checkbox',
        accelerator: keybindings.getAccelerator('paragraph.heading-1') ?? undefined,
        click(_menuItem, focusedWindow) {
          actions.heading1(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        id: 'heading2MenuItem',
        label: t('menu.paragraph.heading2'),
        type: 'checkbox',
        accelerator: keybindings.getAccelerator('paragraph.heading-2') ?? undefined,
        click(_menuItem, focusedWindow) {
          actions.heading2(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        id: 'heading3MenuItem',
        label: t('menu.paragraph.heading3'),
        type: 'checkbox',
        accelerator: keybindings.getAccelerator('paragraph.heading-3') ?? undefined,
        click(_menuItem, focusedWindow) {
          actions.heading3(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        id: 'heading4MenuItem',
        label: t('menu.paragraph.heading4'),
        type: 'checkbox',
        accelerator: keybindings.getAccelerator('paragraph.heading-4') ?? undefined,
        click(_menuItem, focusedWindow) {
          actions.heading4(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        id: 'heading5MenuItem',
        label: t('menu.paragraph.heading5'),
        type: 'checkbox',
        accelerator: keybindings.getAccelerator('paragraph.heading-5') ?? undefined,
        click(_menuItem, focusedWindow) {
          actions.heading5(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        id: 'heading6MenuItem',
        label: t('menu.paragraph.heading6'),
        type: 'checkbox',
        accelerator: keybindings.getAccelerator('paragraph.heading-6') ?? undefined,
        click(_menuItem, focusedWindow) {
          actions.heading6(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        type: 'separator'
      },
      {
        id: 'upgradeHeadingMenuItem',
        label: t('menu.paragraph.promoteHeading'),
        accelerator: keybindings.getAccelerator('paragraph.upgrade-heading') ?? undefined,
        click(_menuItem, focusedWindow) {
          actions.increaseHeading(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        id: 'degradeHeadingMenuItem',
        label: t('menu.paragraph.demoteHeading'),
        accelerator: keybindings.getAccelerator('paragraph.degrade-heading') ?? undefined,
        click(_menuItem, focusedWindow) {
          actions.degradeHeading(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        type: 'separator'
      },
      {
        id: 'tableMenuItem',
        label: t('menu.paragraph.table'),
        type: 'checkbox',
        accelerator: keybindings.getAccelerator('paragraph.table') ?? undefined,
        click(_menuItem, focusedWindow) {
          actions.table(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        id: 'codeFencesMenuItem',
        label: t('menu.paragraph.codeFences'),
        type: 'checkbox',
        accelerator: keybindings.getAccelerator('paragraph.code-fence') ?? undefined,
        click(_menuItem, focusedWindow) {
          actions.codeFence(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        id: 'quoteBlockMenuItem',
        label: t('menu.paragraph.quoteBlock'),
        type: 'checkbox',
        accelerator: keybindings.getAccelerator('paragraph.quote-block') ?? undefined,
        click(_menuItem, focusedWindow) {
          actions.quoteBlock(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        id: 'mathBlockMenuItem',
        label: t('menu.paragraph.mathBlock'),
        type: 'checkbox',
        accelerator: keybindings.getAccelerator('paragraph.math-formula') ?? undefined,
        click(_menuItem, focusedWindow) {
          actions.mathFormula(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        id: 'htmlBlockMenuItem',
        label: t('menu.paragraph.htmlBlock'),
        type: 'checkbox',
        accelerator: keybindings.getAccelerator('paragraph.html-block') ?? undefined,
        click(_menuItem, focusedWindow) {
          actions.htmlBlock(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        type: 'separator'
      },
      {
        id: 'orderListMenuItem',
        label: t('menu.paragraph.orderedList'),
        type: 'checkbox',
        accelerator: keybindings.getAccelerator('paragraph.order-list') ?? undefined,
        click(_menuItem, focusedWindow) {
          actions.orderedList(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        id: 'bulletListMenuItem',
        label: t('menu.paragraph.bulletList'),
        type: 'checkbox',
        accelerator: keybindings.getAccelerator('paragraph.bullet-list') ?? undefined,
        click(_menuItem, focusedWindow) {
          actions.bulletList(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        id: 'taskListMenuItem',
        label: t('menu.paragraph.taskList'),
        type: 'checkbox',
        accelerator: keybindings.getAccelerator('paragraph.task-list') ?? undefined,
        click(_menuItem, focusedWindow) {
          actions.taskList(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        type: 'separator'
      },
      {
        id: 'looseListItemMenuItem',
        label: t('menu.paragraph.looseListItem'),
        type: 'checkbox',
        accelerator: keybindings.getAccelerator('paragraph.loose-list-item') ?? undefined,
        click(_menuItem, focusedWindow) {
          actions.looseListItem(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        type: 'separator'
      },
      {
        id: 'paragraphMenuItem',
        label: t('menu.paragraph.paragraph'),
        type: 'checkbox',
        accelerator: keybindings.getAccelerator('paragraph.paragraph') ?? undefined,
        click(_menuItem, focusedWindow) {
          actions.paragraph(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        id: 'horizontalLineMenuItem',
        label: t('menu.paragraph.horizontalRule'),
        type: 'checkbox',
        accelerator: keybindings.getAccelerator('paragraph.horizontal-line') ?? undefined,
        click(_menuItem, focusedWindow) {
          actions.horizontalLine(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        id: 'frontMatterMenuItem',
        label: t('menu.paragraph.frontMatter'),
        type: 'checkbox',
        accelerator: keybindings.getAccelerator('paragraph.front-matter') ?? undefined,
        click(_menuItem, focusedWindow) {
          actions.frontMatter(focusedWindow as BrowserWindow | undefined)
        }
      }
    ]
  }
}
