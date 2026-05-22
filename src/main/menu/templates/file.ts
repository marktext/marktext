import { app, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import * as actions from '../actions/file'
import { userSetting } from '../actions/marktext'
import { isOsx } from '../../config'
import { t } from '../../i18n'
import type Keybindings from '../../keyboard/shortcutHandler'
import type Preference from '../../preferences'

export default function(
  keybindings: Keybindings,
  userPreference: Preference,
  recentlyUsedFiles: string[]
): MenuItemConstructorOptions {
  const { autoSave } = userPreference.getAll() as { autoSave?: boolean }
  const submenu: MenuItemConstructorOptions[] = [
    {
      label: t('menu.file.newTab'),
      ...keybindings.acceleratorFor('file.new-tab'),
      click(_menuItem, browserWindow) {
        actions.newBlankTab(browserWindow as BrowserWindow | undefined)
      }
    },
    {
      label: t('menu.file.newWindow'),
      ...keybindings.acceleratorFor('file.new-window'),
      click() {
        actions.newEditorWindow()
      }
    },
    {
      type: 'separator'
    },
    {
      label: t('menu.file.openFile'),
      ...keybindings.acceleratorFor('file.open-file'),
      click(_menuItem, browserWindow) {
        actions.openFile((browserWindow as BrowserWindow | undefined) ?? null)
      }
    },
    {
      label: t('menu.file.openFolder'),
      ...keybindings.acceleratorFor('file.open-folder'),
      click(_menuItem, browserWindow) {
        actions.openFolder((browserWindow as BrowserWindow | undefined) ?? null)
      }
    }
  ]

  const fileMenu: MenuItemConstructorOptions = {
    label: t('menu.file.file'),
    submenu
  }

  if (!isOsx) {
    const recentlyUsedSubmenu: MenuItemConstructorOptions[] = []
    const recentlyUsedMenu: MenuItemConstructorOptions = {
      label: t('menu.file.openRecent'),
      submenu: recentlyUsedSubmenu
    }

    for (const item of recentlyUsedFiles) {
      recentlyUsedSubmenu.push({
        label: item,
        click(menuItem, browserWindow) {
          if (browserWindow) {
            actions.openFileOrFolder(browserWindow as BrowserWindow, menuItem.label)
          }
        }
      })
    }

    recentlyUsedSubmenu.push(
      {
        type: 'separator',
        visible: recentlyUsedFiles.length > 0
      },
      {
        label: t('menu.file.clearRecentlyUsed'),
        enabled: recentlyUsedFiles.length > 0,
        click() {
          actions.clearRecentlyUsed()
        }
      }
    )
    submenu.push(recentlyUsedMenu)
  } else {
    submenu.push({
      // Electron accepts these MenuItem roles. The types stub camelCase
      // ('recentDocuments' / 'clearRecentDocuments') in recent versions; the JS
      // original used lowercase. Cast to satisfy strict role typing while
      // preserving the original runtime string.
      role: 'recentdocuments' as unknown as NonNullable<MenuItemConstructorOptions['role']>,
      submenu: [
        {
          role: 'clearrecentdocuments' as unknown as NonNullable<MenuItemConstructorOptions['role']>
        }
      ]
    })
  }

  submenu.push(
    {
      type: 'separator'
    },
    {
      label: t('menu.file.save'),
      ...keybindings.acceleratorFor('file.save'),
      click(_menuItem, browserWindow) {
        actions.save(browserWindow as BrowserWindow | undefined)
      }
    },
    {
      label: t('menu.file.saveAs'),
      ...keybindings.acceleratorFor('file.save-as'),
      click(_menuItem, browserWindow) {
        actions.saveAs(browserWindow as BrowserWindow | undefined)
      }
    },
    {
      label: t('menu.file.autoSave'),
      type: 'checkbox',
      checked: !!autoSave,
      id: 'autoSaveMenuItem',
      click(menuItem, browserWindow) {
        actions.autoSave(menuItem, browserWindow as BrowserWindow | undefined)
      }
    },
    {
      type: 'separator'
    },
    {
      label: t('menu.file.moveTo'),
      ...keybindings.acceleratorFor('file.move-file'),
      click(_menuItem, browserWindow) {
        actions.moveTo(browserWindow as BrowserWindow | undefined)
      }
    },
    {
      label: t('menu.file.rename'),
      ...keybindings.acceleratorFor('file.rename-file'),
      click(_menuItem, browserWindow) {
        actions.rename(browserWindow as BrowserWindow | undefined)
      }
    },
    {
      type: 'separator'
    },
    {
      label: t('menu.file.import'),
      click(_menuItem, browserWindow) {
        actions.importFile((browserWindow as BrowserWindow | undefined) ?? null)
      }
    },
    {
      label: t('menu.file.export'),
      submenu: [
        {
          label: t('menu.file.exportHtml'),
          click(_menuItem, browserWindow) {
            actions.exportFile(browserWindow as BrowserWindow | undefined, 'styledHtml')
          }
        },
        {
          label: t('menu.file.exportPdf'),
          ...keybindings.acceleratorFor('file.export-file.pdf'),
          click(_menuItem, browserWindow) {
            actions.exportFile(browserWindow as BrowserWindow | undefined, 'pdf')
          }
        }
      ]
    },
    {
      label: t('menu.file.print'),
      ...keybindings.acceleratorFor('file.print'),
      click(_menuItem, browserWindow) {
        actions.printDocument(browserWindow as BrowserWindow | undefined)
      }
    },
    {
      type: 'separator',
      visible: !isOsx
    },
    {
      label: t('menu.file.preferences'),
      ...keybindings.acceleratorFor('file.preferences'),
      visible: !isOsx,
      click() {
        userSetting()
      }
    },
    {
      type: 'separator'
    },
    {
      label: t('menu.file.closeTab'),
      ...keybindings.acceleratorFor('file.close-tab'),
      click(_menuItem, browserWindow) {
        actions.closeTab(browserWindow as BrowserWindow | undefined)
      }
    },
    {
      label: t('menu.file.closeWindow'),
      ...keybindings.acceleratorFor('file.close-window'),
      click(_menuItem, browserWindow) {
        actions.closeWindow(browserWindow as BrowserWindow | undefined)
      }
    },
    {
      type: 'separator',
      visible: !isOsx
    },
    {
      label: t('menu.file.quit'),
      ...keybindings.acceleratorFor('file.quit'),
      visible: !isOsx,
      click: app.quit
    }
  )
  return fileMenu
}
