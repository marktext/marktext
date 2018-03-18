import { shell } from 'electron'

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
  }]
}
