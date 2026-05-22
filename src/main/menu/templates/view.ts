import { type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import * as actions from '../actions/view'
import { t } from '../../i18n'
import type Keybindings from '../../keyboard/shortcutHandler'

export default function(keybindings: Keybindings): MenuItemConstructorOptions {
  const submenu: MenuItemConstructorOptions[] = [
    {
      label: t('menu.view.commandPalette'),
      ...keybindings.acceleratorFor('view.command-palette'),
      click(_menuItem, focusedWindow) {
        actions.showCommandPalette(focusedWindow as BrowserWindow | undefined)
      }
    },
    {
      type: 'separator'
    },
    {
      id: 'sourceCodeModeMenuItem',
      label: t('menu.view.sourceCodeMode'),
      ...keybindings.acceleratorFor('view.source-code-mode'),
      type: 'checkbox',
      checked: false,
      click(_item, focusedWindow) {
        actions.toggleSourceCodeMode(focusedWindow as BrowserWindow | undefined)
      }
    },
    {
      id: 'typewriterModeMenuItem',
      label: t('menu.view.typewriterMode'),
      ...keybindings.acceleratorFor('view.typewriter-mode'),
      type: 'checkbox',
      checked: false,
      click(_item, focusedWindow) {
        actions.toggleTypewriterMode(focusedWindow as BrowserWindow | undefined)
      }
    },
    {
      id: 'focusModeMenuItem',
      label: t('menu.view.focusMode'),
      ...keybindings.acceleratorFor('view.focus-mode'),
      type: 'checkbox',
      checked: false,
      click(_item, focusedWindow) {
        actions.toggleFocusMode(focusedWindow as BrowserWindow | undefined)
      }
    },
    {
      type: 'separator'
    },
    {
      label: t('menu.view.toggleSidebar'),
      id: 'sideBarMenuItem',
      ...keybindings.acceleratorFor('view.toggle-sidebar'),
      type: 'checkbox',
      checked: false,
      click(_item, focusedWindow) {
        actions.toggleSidebar(focusedWindow as BrowserWindow | undefined)
      }
    },
    {
      label: t('menu.view.toggleTabbar'),
      id: 'tabBarMenuItem',
      ...keybindings.acceleratorFor('view.toggle-tabbar'),
      type: 'checkbox',
      checked: false,
      click(_item, focusedWindow) {
        actions.toggleTabBar(focusedWindow as BrowserWindow | undefined)
      }
    },
    {
      label: t('menu.view.toggleTableOfContents'),
      id: 'tocMenuItem',
      ...keybindings.acceleratorFor('view.toggle-toc'),
      click(_, focusedWindow) {
        actions.showTableOfContents(focusedWindow as BrowserWindow | undefined)
      }
    },
    {
      label: t('menu.view.reloadImages'),
      ...keybindings.acceleratorFor('view.reload-images'),
      click(_item, focusedWindow) {
        actions.reloadImageCache(focusedWindow as BrowserWindow | undefined)
      }
    }
  ]

  const viewMenu: MenuItemConstructorOptions = {
    label: t('menu.view.view'),
    submenu
  }

  if (global.MARKTEXT_DEBUG) {
    submenu.push({
      type: 'separator'
    })
    submenu.push({
      label: t('menu.view.showDeveloperTools'),
      ...keybindings.acceleratorFor('view.toggle-dev-tools'),
      click(_item, win) {
        actions.debugToggleDevTools(win as BrowserWindow | undefined)
      }
    })
    submenu.push({
      label: t('menu.view.reloadWindow'),
      ...keybindings.acceleratorFor('view.dev-reload'),
      click(_item, focusedWindow) {
        actions.debugReloadWindow(focusedWindow as BrowserWindow | undefined)
      }
    })
  }

  return viewMenu
}
