import * as actions from '../actions/format'

export default function (keybindings) {
  return {
    id: 'formatMenuItem',
    label: 'Format',
    submenu: [{
      id: 'strongMenuItem',
      label: 'Strong',
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('formatStrong'),
      click (menuItem, browserWindow) {
        actions.format(browserWindow, 'strong')
      }
    }, {
      id: 'emphasisMenuItem',
      label: 'Emphasis',
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('formatEmphasis'),
      click (menuItem, browserWindow) {
        actions.format(browserWindow, 'em')
      }
    }, {
      id: 'underlineMenuItem',
      label: 'Underline',
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('formatUnderline'),
      click (menuItem, browserWindow) {
        actions.format(browserWindow, 'u')
      }
    }, {
      type: 'separator'
    }, {
      id: 'superscriptMenuItem',
      label: 'Superscript',
      type: 'checkbox',
      click (menuItem, browserWindow) {
        actions.format(browserWindow, 'sup')
      }
    }, {
      id: 'subscriptMenuItem',
      label: 'Subscript',
      type: 'checkbox',
      click (menuItem, browserWindow) {
        actions.format(browserWindow, 'sub')
      }
    }, {
      type: 'separator'
    }, {
      id: 'inlineCodeMenuItem',
      label: 'Inline Code',
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('formatInlineCode'),
      click (menuItem, browserWindow) {
        actions.format(browserWindow, 'inline_code')
      }
    }, {
      id: 'inlineMathMenuItem',
      label: 'Inline Math',
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('formatInlineMath'),
      click (menuItem, browserWindow) {
        actions.format(browserWindow, 'inline_math')
      }
    }, {
      type: 'separator'
    }, {
      id: 'strikeMenuItem',
      label: 'Strike',
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('formatStrike'),
      click (menuItem, browserWindow) {
        actions.format(browserWindow, 'del')
      }
    }, {
      id: 'hyperlinkMenuItem',
      label: 'Hyperlink',
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('formatHyperlink'),
      click (menuItem, browserWindow) {
        actions.format(browserWindow, 'link')
      }
    }, {
      id: 'imageMenuItem',
      label: 'Image',
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('formatImage'),
      click (menuItem, browserWindow) {
        actions.format(browserWindow, 'image')
      }
    }, {
      type: 'separator'
    }, {
      label: 'Clear Format',
      accelerator: keybindings.getAccelerator('formatClearFormat'),
      click (menuItem, browserWindow) {
        actions.format(browserWindow, 'clear')
      }
    }]
  }
}
