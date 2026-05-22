import { app, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { showAboutDialog } from '../actions/help'
import * as actions from '../actions/marktext'
import { t } from '../../i18n'
import type Keybindings from '../../keyboard/shortcutHandler'

// macOS only menu.

export default function(keybindings: Keybindings): MenuItemConstructorOptions {
  return {
    label: t('menu.marktext.title'),
    submenu: [
      {
        label: t('menu.marktext.about'),
        click(_menuItem, focusedWindow) {
          showAboutDialog(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        label: t('menu.marktext.checkUpdates'),
        click(_menuItem, focusedWindow) {
          actions.checkUpdates((focusedWindow as BrowserWindow | undefined) ?? null)
        }
      },
      {
        label: t('menu.marktext.preferences'),
        ...keybindings.acceleratorFor('file.preferences'),
        click() {
          actions.userSetting()
        }
      },
      {
        type: 'separator'
      },
      {
        label: t('menu.marktext.services'),
        role: 'services',
        submenu: []
      },
      {
        type: 'separator'
      },
      {
        label: t('menu.marktext.hide'),
        ...keybindings.acceleratorFor('mt.hide'),
        click() {
          actions.osxHide()
        }
      },
      {
        label: t('menu.marktext.hideOthers'),
        ...keybindings.acceleratorFor('mt.hide-others'),
        click() {
          actions.osxHideAll()
        }
      },
      {
        label: t('menu.marktext.showAll'),
        click() {
          actions.osxShowAll()
        }
      },
      {
        type: 'separator'
      },
      {
        label: t('menu.marktext.quit'),
        ...keybindings.acceleratorFor('file.quit'),
        click: app.quit
      }
    ]
  }
}
