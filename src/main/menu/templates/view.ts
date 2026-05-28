import { type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import * as actions from '../actions/view'
import { t } from '../../i18n'
import type Keybindings from '../../keyboard/shortcutHandler'

export default function(keybindings: Keybindings): MenuItemConstructorOptions {
  const submenu: MenuItemConstructorOptions[] = [
    {
      label: t('menu.view.commandPalette'),
      accelerator: keybindings.getAccelerator('view.command-palette') ?? undefined,
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
      accelerator: keybindings.getAccelerator('view.source-code-mode') ?? undefined,
      type: 'checkbox',
      checked: false,
      click(_item, focusedWindow) {
        actions.toggleSourceCodeMode(focusedWindow as BrowserWindow | undefined)
      }
    },
    {
      id: 'typewriterModeMenuItem',
      label: t('menu.view.typewriterMode'),
      accelerator: keybindings.getAccelerator('view.typewriter-mode') ?? undefined,
      type: 'checkbox',
      checked: false,
      click(_item, focusedWindow) {
        actions.toggleTypewriterMode(focusedWindow as BrowserWindow | undefined)
      }
    },
    {
      id: 'focusModeMenuItem',
      label: t('menu.view.focusMode'),
      accelerator: keybindings.getAccelerator('view.focus-mode') ?? undefined,
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
      accelerator: keybindings.getAccelerator('view.toggle-sidebar') ?? undefined,
      type: 'checkbox',
      checked: false,
      click(_item, focusedWindow) {
        actions.toggleSidebar(focusedWindow as BrowserWindow | undefined)
      }
    },
    {
      label: t('menu.view.toggleTabbar'),
      id: 'tabBarMenuItem',
      accelerator: keybindings.getAccelerator('view.toggle-tabbar') ?? undefined,
      type: 'checkbox',
      checked: false,
      click(_item, focusedWindow) {
        actions.toggleTabBar(focusedWindow as BrowserWindow | undefined)
      }
    },
    {
      label: t('menu.view.toggleTableOfContents'),
      id: 'tocMenuItem',
      accelerator: keybindings.getAccelerator('view.toggle-toc') ?? undefined,
      click(_, focusedWindow) {
        actions.showTableOfContents(focusedWindow as BrowserWindow | undefined)
      }
    },
    {
      label: t('menu.view.reloadImages'),
      accelerator: keybindings.getAccelerator('view.reload-images') ?? undefined,
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
      accelerator: keybindings.getAccelerator('view.toggle-dev-tools') ?? undefined,
      click(_item, win) {
        actions.debugToggleDevTools(win as BrowserWindow | undefined)
      }
    })
    submenu.push({
      label: t('menu.view.reloadWindow'),
      accelerator: keybindings.getAccelerator('view.dev-reload') ?? undefined,
      click(_item, focusedWindow) {
        actions.debugReloadWindow(focusedWindow as BrowserWindow | undefined)
      }
    })
  }

  return viewMenu
}
