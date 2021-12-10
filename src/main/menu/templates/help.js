import path from 'path'
import { shell } from 'electron'
import { isFile } from 'common/filesystem'
import * as actions from '../actions/help'
import { checkUpdates } from '../actions/marktext'
import i18n from '../../i18n'

/// Check whether the package is updatable at runtime.
const isUpdatable = () => {
  // TODO: If not updatable, allow to check whether there is a new version available.

  const resFile = isFile(path.join(process.resourcesPath, 'app-update.yml'))
  if (!resFile) {
    // No update resource file available.
    return false
  } else if (process.env.APPIMAGE) {
    // We are running as AppImage.
    return true
  } else if (process.platform === 'win32' && isFile(path.join(process.resourcesPath, 'md.ico'))) {
    // Windows is a little but tricky. The update resource file is always available and
    // there is no way to check the target type at runtime (electron-builder#4119).
    // As workaround we check whether "md.ico" exists that is only included in the setup.
    return true
  }

  // Otherwise assume that we cannot perform an auto update (standalone binary, archives,
  // packed for package manager).
  return false
}

export default function () {
  const helpMenu = {
    label: i18n.t('menu.help._title'),
    role: 'help',
    submenu: [{
    label: i18n.t('menu.help.quickStart'),
      click () {
        shell.openExternal('https://github.com/marktext/marktext/blob/master/docs/README.md')
      }
    }, {
    label: i18n.t('menu.help.markdownReference'),
      click () {
        shell.openExternal('https://github.com/marktext/marktext/blob/master/docs/MARKDOWN_SYNTAX.md')
      }
    }, {
    label: i18n.t('menu.help.changeLog'),
      click () {
        shell.openExternal('https://github.com/marktext/marktext/blob/master/.github/CHANGELOG.md')
      }
    }, {
      type: 'separator'
    }, {
    label: i18n.t('menu.help.donateViaOpenCollective'),
      click (item, win) {
        shell.openExternal('https://opencollective.com/marktext')
      }
    }, {
    label: i18n.t('menu.help.feedbackViaTwitter'),
      click (item, win) {
        actions.showTweetDialog(win, 'twitter')
      }
    }, {
    label: i18n.t('menu.help.reportIssueOrRequestFeature'),
      click () {
        shell.openExternal('https://github.com/marktext/marktext/issues')
      }
    }, {
      type: 'separator'
    }, {
    label: i18n.t('menu.help.website'),
      click () {
        shell.openExternal('https://marktext.app')
      }
    }, {
    label: i18n.t('menu.help.watchOnGithub'),
      click () {
        shell.openExternal('https://github.com/marktext/marktext')
      }
    }, {
      label: i18n.t('menu.help.followUsOnGithub'),
      click () {
        shell.openExternal('https://github.com/Jocs')
      }
    }, {
      label: i18n.t('menu.help.followUsOnTwitter'),
      click () {
        shell.openExternal('https://twitter.com/marktextapp')
      }
    }, {
      type: 'separator'
    }, {
      label: i18n.t('menu.help.license'),
      click () {
        shell.openExternal('https://github.com/marktext/marktext/blob/master/LICENSE')
      }
    }]
  }

  if (isUpdatable()) {
    helpMenu.submenu.push({
      type: 'separator'
    }, {
      label: i18n.t('menu.help.checkUpdates'),
      click (menuItem, browserWindow) {
        checkUpdates(browserWindow)
      }
    })
  }

  if (process.platform !== 'darwin') {
    helpMenu.submenu.push({
      type: 'separator'
    }, {
      label: i18n.t('menu.help.about'),
      click (menuItem, browserWindow) {
        actions.showAboutDialog(browserWindow)
      }
    })
  }
  return helpMenu
}
