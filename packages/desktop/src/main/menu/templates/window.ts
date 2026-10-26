import { Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import {
  decreaseWindowOpacity,
  increaseWindowOpacity,
  minimizeWindow,
  toggleAlwaysOnTop,
  toggleFullScreen
} from '../actions/window'
import { zoomIn, zoomOut, resetZoom } from '../../windows/utils'
import { isLinux, isOsx } from '../../config'
import { t } from '../../i18n'
import type Keybindings from '../../keyboard/shortcutHandler'
import type Preference from '../../preferences'

export default function(
  keybindings: Keybindings,
  preferences: Preference
): MenuItemConstructorOptions {
  // Electron's setOpacity is a no-op on Linux, so the items would do nothing there.
  const opacityMenuItems: MenuItemConstructorOptions[] = isLinux
    ? []
    : [
      {
        label: t('menu.window.increaseOpacity'),
        accelerator: keybindings.getAccelerator('window.increase-opacity') ?? undefined,
        click(_menuItem, browserWindow) {
          increaseWindowOpacity(browserWindow as BrowserWindow | undefined, preferences)
        }
      },
      {
        label: t('menu.window.decreaseOpacity'),
        accelerator: keybindings.getAccelerator('window.decrease-opacity') ?? undefined,
        click(_menuItem, browserWindow) {
          decreaseWindowOpacity(browserWindow as BrowserWindow | undefined, preferences)
        }
      },
      {
        type: 'separator'
      }
    ]

  const submenu: MenuItemConstructorOptions[] = [
    {
      label: t('menu.window.minimize'),
      accelerator: keybindings.getAccelerator('window.minimize') ?? undefined,
      click(_menuItem, browserWindow) {
        minimizeWindow(browserWindow as BrowserWindow | undefined)
      }
    },
    {
      id: 'alwaysOnTopMenuItem',
      label: t('menu.window.alwaysOnTop'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('window.toggle-always-on-top') ?? undefined,
      click(_menuItem, browserWindow) {
        toggleAlwaysOnTop(browserWindow as BrowserWindow | undefined)
      }
    },
    {
      type: 'separator'
    },
    {
      label: t('menu.window.zoomIn'),
      accelerator: keybindings.getAccelerator('window.zoomIn') ?? undefined,
      click(_menuItem, browserWindow) {
        zoomIn(browserWindow as BrowserWindow | undefined)
      }
    },
    {
      label: t('menu.window.zoomOut'),
      accelerator: keybindings.getAccelerator('window.zoomOut') ?? undefined,
      click(_menuItem, browserWindow) {
        zoomOut(browserWindow as BrowserWindow | undefined)
      }
    },
    {
      label: t('menu.window.resetZoom'),
      accelerator: keybindings.getAccelerator('window.resetZoom') ?? undefined,
      click(_menuItem, browserWindow) {
        resetZoom(browserWindow as BrowserWindow | undefined)
      }
    },
    {
      type: 'separator'
    },
    ...opacityMenuItems,
    {
      label: t('menu.window.fullScreen'),
      accelerator: keybindings.getAccelerator('window.toggle-full-screen') ?? undefined,
      click(_item, browserWindow) {
        if (browserWindow) {
          toggleFullScreen(browserWindow as BrowserWindow)
        }
      }
    }
  ]

  const menu: MenuItemConstructorOptions = {
    label: t('menu.window.title'),
    role: 'window',
    submenu
  }

  if (isOsx) {
    submenu.push({
      label: t('menu.window.bringAllToFront'),
      click() {
        Menu.sendActionToFirstResponder('arrangeInFront:')
      }
    })
  }
  return menu
}
