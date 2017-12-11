import { shell } from 'electron'

export default {
  label: 'Help',
  role: 'help',
  submenu: [{
    label: 'Learn More',
    click: function () {
      shell.openExternal('https://github.com/Jocs/aganippe')
    }
  }, {
    label: 'Report Issue',
    click: function () {
      shell.openExternal('https://github.com/Jocs/aganippe/issues')
    }
  }, {
    label: 'Source Code on GitHub',
    click: function () {
      shell.openExternal('https://github.com/Jocs/aganippe')
    }
  }, {
    label: 'Changelog',
    click: function () {
      shell.openExternal('https://github.com/Jocs/aganippe/blob/master/CHANGELOG.md')
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
