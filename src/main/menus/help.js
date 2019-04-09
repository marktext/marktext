import path from 'path'
import { shell } from 'electron'
import * as actions from '../actions/help'
import { checkUpdates } from '../actions/marktext'
import { isFile } from '../utils'

const helpMenu = {
  label: 'Help',
  role: 'help',
  submenu: [{
    label: 'Learn More',
    click () {
      shell.openExternal('https://marktext.app')
    }
  }, {
    label: 'Source Code on GitHub',
    click () {
      shell.openExternal('https://github.com/marktext/marktext')
    }
  }, {
    label: 'Changelog',
    click () {
      shell.openExternal('https://github.com/marktext/marktext/blob/master/.github/CHANGELOG.md')
    }
  }, {
    label: 'Markdown syntax',
    click () {
      shell.openExternal('https://spec.commonmark.org/0.28/')
    }
  }, {
    type: 'separator'
  }, {
    label: 'Feedback via Twitter',
    click (item, win) {
      actions.showTweetDialog(win, 'twitter')
    }
  }, {
    label: 'Report Issue or Feature request',
    click () {
      shell.openExternal('https://github.com/marktext/marktext/issues')
    }
  }, {
    type: 'separator'
  }, {
    label: 'Follow @Jocs on Github',
    click () {
      shell.openExternal('https://github.com/Jocs')
    }
  }]
}

if (isFile(path.join(process.resourcesPath, 'app-update.yml')) &&
  (process.platform === 'win32' || !!process.env.APPIMAGE)) {
  helpMenu.submenu.push({
    type: 'separator'
  }, {
    label: 'Check for updates...',
    click (menuItem, browserWindow) {
      checkUpdates(menuItem, browserWindow)
    }
  })
}

if (process.platform !== 'darwin') {
  helpMenu.submenu.push({
    type: 'separator'
  }, {
    label: 'About Mark Text',
    click (menuItem, browserWindow) {
      actions.showAboutDialog(browserWindow)
    }
  })
}

export default helpMenu
