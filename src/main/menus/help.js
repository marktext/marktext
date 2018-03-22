import { shell } from 'electron'
import * as actions from '../actions/help'
import { checkUpdates } from '../actions/marktext'

const notOsx = process.platform !== 'darwin'

export default {
  label: 'Help',
  role: 'help',
  submenu: [{
    label: 'Learn More',
    click: function () {
      shell.openExternal('https://github.com/marktext/marktext')
    }
  }, {
    label: 'Report Issue',
    click: function () {
      shell.openExternal('https://github.com/marktext/marktext/issues')
    }
  }, {
    label: 'Source Code on GitHub',
    click: function () {
      shell.openExternal('https://github.com/marktext/marktext')
    }
  }, {
    label: 'Changelog',
    click: function () {
      shell.openExternal('https://github.com/marktext/marktext/blob/master/.github/CHANGELOG.md')
    }
  }, {
    label: 'Markdown syntax',
    click: function () {
      shell.openExternal('http://spec.commonmark.org/0.28/')
    }
  }, {
    type: 'separator'
  }, {
    label: 'Follow @Jocs on Github',
    click: function () {
      shell.openExternal('https://github.com/Jocs')
    }
  }, {
    type: 'separator',
    visible: notOsx
  }, {
    label: 'Check for updates...',
    visible: notOsx,
    click (menuItem, browserWindow) {
      checkUpdates(menuItem, browserWindow)
    }
  }, {
    type: 'separator',
    visible: notOsx
  }, {
    label: 'About Mark Text',
    visible: notOsx,
    click (menuItem, browserWindow) {
      actions.showAboutDialog(browserWindow)
    }
  }]
}
