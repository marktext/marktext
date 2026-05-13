import * as actions from '../actions/format'
import { t } from '../../i18n'

export default function(keybindings) {
  return {
    id: 'formatMenuItem',
    label: t('menu.format.format'),
    submenu: [{
      id: 'strongMenuItem',
      label: t('menu.format.bold'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('format.strong'),
      click(menuItem, focusedWindow) {
        actions.strong(focusedWindow)
      }
    }, {
      id: 'emphasisMenuItem',
      label: t('menu.format.italic'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('format.emphasis'),
      click(menuItem, focusedWindow) {
        actions.emphasis(focusedWindow)
      }
    }, {
      id: 'underlineMenuItem',
      label: t('menu.format.underline'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('format.underline'),
      click(menuItem, focusedWindow) {
        actions.underline(focusedWindow)
      }
    }, {
      type: 'separator'
    }, {
      id: 'superscriptMenuItem',
      label: t('menu.format.superscript'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('format.superscript'),
      click(menuItem, focusedWindow) {
        actions.superscript(focusedWindow)
      }
    }, {
      id: 'subscriptMenuItem',
      label: t('menu.format.subscript'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('format.subscript'),
      click(menuItem, focusedWindow) {
        actions.subscript(focusedWindow)
      }
    }, {
      id: 'highlightMenuItem',
      label: t('menu.format.highlight'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('format.highlight'),
      click(menuItem, focusedWindow) {
        actions.highlight(focusedWindow)
      }
    }, {
      type: 'separator'
    }, {
      id: 'inlineCodeMenuItem',
      label: t('menu.format.inlineCode'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('format.inline-code'),
      click(menuItem, focusedWindow) {
        actions.inlineCode(focusedWindow)
      }
    }, {
      id: 'inlineMathMenuItem',
      label: t('menu.format.inlineMath'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('format.inline-math'),
      click(menuItem, focusedWindow) {
        actions.inlineMath(focusedWindow)
      }
    }, {
      type: 'separator'
    }, {
      id: 'strikeMenuItem',
      label: t('menu.format.strikethrough'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('format.strike'),
      click(menuItem, focusedWindow) {
        actions.strikethrough(focusedWindow)
      }
    }, {
      id: 'hyperlinkMenuItem',
      label: t('menu.format.hyperlink'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('format.hyperlink'),
      click(menuItem, focusedWindow) {
        actions.hyperlink(focusedWindow)
      }
    }, {
      id: 'imageMenuItem',
      label: t('menu.format.image'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('format.image'),
      click(menuItem, focusedWindow) {
        actions.image(focusedWindow)
      }
    }, {
      type: 'separator'
    }, {
      label: t('menu.format.clearFormat'),
      accelerator: keybindings.getAccelerator('format.clear-format'),
      click(menuItem, focusedWindow) {
        actions.clearFormat(focusedWindow)
      }
    }]
  }
}
