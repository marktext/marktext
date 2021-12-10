import * as actions from '../actions/format'
import i18n from '../../i18n'

export default function (keybindings) {
  return {
    id: 'formatMenuItem',
    label: i18n.t('menu.format._title'),
    submenu: [{
      id: 'strongMenuItem',
      label: i18n.t('menu.format.bold'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('format.strong'),
      click (menuItem, browserWindow) {
        actions.format(browserWindow, 'strong')
      }
    }, {
      id: 'emphasisMenuItem',
      label: i18n.t('menu.format.italic'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('format.emphasis'),
      click (menuItem, browserWindow) {
        actions.format(browserWindow, 'em')
      }
    }, {
      id: 'underlineMenuItem',
      label: i18n.t('menu.format.underline'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('format.underline'),
      click (menuItem, browserWindow) {
        actions.format(browserWindow, 'u')
      }
    }, {
      type: 'separator'
    }, {
      id: 'superscriptMenuItem',
      label: i18n.t('menu.format.superscript'),
      type: 'checkbox',
      click (menuItem, browserWindow) {
        actions.format(browserWindow, 'sup')
      }
    }, {
      id: 'subscriptMenuItem',
      label: i18n.t('menu.format.subscript'),
      type: 'checkbox',
      click (menuItem, browserWindow) {
        actions.format(browserWindow, 'sub')
      }
    }, {
      id: 'highlightMenuItem',
      label: i18n.t('menu.format.highlight'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('format.highlight'),
      click (menuItem, browserWindow) {
        actions.format(browserWindow, 'mark')
      }
    }, {
      type: 'separator'
    }, {
      id: 'inlineCodeMenuItem',
      label: i18n.t('menu.format.inlineCode'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('format.inline-code'),
      click (menuItem, browserWindow) {
        actions.format(browserWindow, 'inline_code')
      }
    }, {
      id: 'inlineMathMenuItem',
      label: i18n.t('menu.format.inlineMath'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('format.inline-math'),
      click (menuItem, browserWindow) {
        actions.format(browserWindow, 'inline_math')
      }
    }, {
      type: 'separator'
    }, {
      id: 'strikeMenuItem',
      label: i18n.t('menu.format.strike'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('format.strike'),
      click (menuItem, browserWindow) {
        actions.format(browserWindow, 'del')
      }
    }, {
      id: 'hyperlinkMenuItem',
      label: i18n.t('menu.format.hyperlink'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('format.hyperlink'),
      click (menuItem, browserWindow) {
        actions.format(browserWindow, 'link')
      }
    }, {
      id: 'imageMenuItem',
      label: i18n.t('menu.format.image'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('format.image'),
      click (menuItem, browserWindow) {
        actions.format(browserWindow, 'image')
      }
    }, {
      type: 'separator'
    }, {
      label: i18n.t('menu.format.clear'),
      accelerator: keybindings.getAccelerator('format.clear-format'),
      click (menuItem, browserWindow) {
        actions.format(browserWindow, 'clear')
      }
    }]
  }
}
