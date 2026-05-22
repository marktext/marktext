import { type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import * as actions from '../actions/format'
import { t } from '../../i18n'
import type Keybindings from '../../keyboard/shortcutHandler'

export default function(keybindings: Keybindings): MenuItemConstructorOptions {
  return {
    id: 'formatMenuItem',
    label: t('menu.format.format'),
    submenu: [
      {
        id: 'strongMenuItem',
        label: t('menu.format.bold'),
        type: 'checkbox',
        ...keybindings.acceleratorFor('format.strong'),
        click(_menuItem, focusedWindow) {
          actions.strong(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        id: 'emphasisMenuItem',
        label: t('menu.format.italic'),
        type: 'checkbox',
        ...keybindings.acceleratorFor('format.emphasis'),
        click(_menuItem, focusedWindow) {
          actions.emphasis(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        id: 'underlineMenuItem',
        label: t('menu.format.underline'),
        type: 'checkbox',
        ...keybindings.acceleratorFor('format.underline'),
        click(_menuItem, focusedWindow) {
          actions.underline(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        type: 'separator'
      },
      {
        id: 'superscriptMenuItem',
        label: t('menu.format.superscript'),
        type: 'checkbox',
        ...keybindings.acceleratorFor('format.superscript'),
        click(_menuItem, focusedWindow) {
          actions.superscript(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        id: 'subscriptMenuItem',
        label: t('menu.format.subscript'),
        type: 'checkbox',
        ...keybindings.acceleratorFor('format.subscript'),
        click(_menuItem, focusedWindow) {
          actions.subscript(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        id: 'highlightMenuItem',
        label: t('menu.format.highlight'),
        type: 'checkbox',
        ...keybindings.acceleratorFor('format.highlight'),
        click(_menuItem, focusedWindow) {
          actions.highlight(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        type: 'separator'
      },
      {
        id: 'inlineCodeMenuItem',
        label: t('menu.format.inlineCode'),
        type: 'checkbox',
        ...keybindings.acceleratorFor('format.inline-code'),
        click(_menuItem, focusedWindow) {
          actions.inlineCode(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        id: 'inlineMathMenuItem',
        label: t('menu.format.inlineMath'),
        type: 'checkbox',
        ...keybindings.acceleratorFor('format.inline-math'),
        click(_menuItem, focusedWindow) {
          actions.inlineMath(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        type: 'separator'
      },
      {
        id: 'strikeMenuItem',
        label: t('menu.format.strikethrough'),
        type: 'checkbox',
        ...keybindings.acceleratorFor('format.strike'),
        click(_menuItem, focusedWindow) {
          actions.strikethrough(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        id: 'hyperlinkMenuItem',
        label: t('menu.format.hyperlink'),
        type: 'checkbox',
        ...keybindings.acceleratorFor('format.hyperlink'),
        click(_menuItem, focusedWindow) {
          actions.hyperlink(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        id: 'imageMenuItem',
        label: t('menu.format.image'),
        type: 'checkbox',
        ...keybindings.acceleratorFor('format.image'),
        click(_menuItem, focusedWindow) {
          actions.image(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        type: 'separator'
      },
      {
        label: t('menu.format.clearFormat'),
        ...keybindings.acceleratorFor('format.clear-format'),
        click(_menuItem, focusedWindow) {
          actions.clearFormat(focusedWindow as BrowserWindow | undefined)
        }
      }
    ]
  }
}
