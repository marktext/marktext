import { app, dialog, shell } from 'electron'
import { checkUpdates } from '../actions/marktext'

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
    visible: process.platform !== 'darwin'
  }, {
    label: 'Check for updates...',
    visible: process.platform !== 'darwin',
    click (menuItem, browserWindow) {
      checkUpdates(menuItem, browserWindow)
    }
  }, {
    type: 'separator',
    visible: process.platform !== 'darwin'
  }, {
    label: 'About Mark Text',
    visible: process.platform !== 'darwin',
    click (menuItem, browserWindow) {
      dialog.showMessageBox(browserWindow, {
        buttons: ['OK'],
        message: 'Mark Text\nv' + app.getVersion() + '\nCopyright © 2018 Jocs',
        title: 'About',
        type: 'info'
      })
    }
  }]
}
