import * as actions from '../actions/format'
import keybindings from '../shortcutHandler'

export default {
  id: 'formatMenuItem',
  label: 'Format',
  submenu: [{
    id: 'strongMenuItem',
    label: 'Strong',
    type: 'checkbox',
    accelerator: keybindings.get('formatStrong'),
    click (menuItem, browserWindow) {
      actions.format(browserWindow, 'strong')
    }
  }, {
    id: 'emphasisMenuItem',
    label: 'Emphasis',
    type: 'checkbox',
    accelerator: keybindings.get('formatEmphasis'),
    click (menuItem, browserWindow) {
      actions.format(browserWindow, 'em')
    }
  }, {
    id: 'inlineCodeMenuItem',
    label: 'Inline Code',
    type: 'checkbox',
    accelerator: keybindings.get('formatInlineCode'),
    click (menuItem, browserWindow) {
      actions.format(browserWindow, 'inline_code')
    }
  }, {
    type: 'separator'
  }, {
    id: 'strikeMenuItem',
    label: 'Strike',
    type: 'checkbox',
    accelerator: keybindings.get('formatStrike'),
    click (menuItem, browserWindow) {
      actions.format(browserWindow, 'del')
    }
  }, {
    id: 'hyperlinkMenuItem',
    label: 'Hyperlink',
    type: 'checkbox',
    accelerator: keybindings.get('formatHyperlink'),
    click (menuItem, browserWindow) {
      actions.format(browserWindow, 'link')
    }
  }, {
    id: 'imageMenuItem',
    label: 'Image',
    type: 'checkbox',
    accelerator: keybindings.get('formatImage'),
    click (menuItem, browserWindow) {
      actions.format(browserWindow, 'image')
    }
  }, {
    type: 'separator'
  }, {
    label: 'Clear Format',
    accelerator: keybindings.get('formatClearFormat'),
    click (menuItem, browserWindow) {
      actions.format(browserWindow, 'clear')
    }
  }]
}
