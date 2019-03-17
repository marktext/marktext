import { app } from 'electron'
import * as actions from '../actions/file'
import { userSetting } from '../actions/marktext'
import { showTabBar } from '../actions/view'
import userPreference from '../preference'
import keybindings from '../shortcutHandler'

export default function (recentlyUsedFiles) {
  const { autoSave } = userPreference.getAll()
  const notOsx = process.platform !== 'darwin'
  let fileMenu = {
    label: 'File',
    submenu: [{
      label: 'New Tab',
      accelerator: keybindings.getAccelerator('fileNewFile'),
      click (menuItem, browserWindow) {
        actions.newTab(browserWindow)
        showTabBar(browserWindow)
      }
    }, {
      label: 'New Window',
      accelerator: keybindings.getAccelerator('fileNewTab'),
      click (menuItem, browserWindow) {
        actions.newFile()
      }
    }, {
      type: 'separator'
    }, {
      label: 'Open File',
      accelerator: keybindings.getAccelerator('fileOpenFile'),
      click (menuItem, browserWindow) {
        actions.openFile(browserWindow)
      }
    }, {
      label: 'Open Folder',
      accelerator: keybindings.getAccelerator('fileOpenFolder'),
      click (menuItem, browserWindow) {
        actions.openFolder(browserWindow)
      }
    }]
  }

  if (notOsx) {
    let recentlyUsedMenu = {
      label: 'Open Recent',
      submenu: []
    }

    for (const item of recentlyUsedFiles) {
      recentlyUsedMenu.submenu.push({
        label: item,
        click (menuItem, browserWindow) {
          actions.openFileOrFolder(browserWindow, menuItem.label)
        }
      })
    }

    recentlyUsedMenu.submenu.push({
      type: 'separator',
      visible: recentlyUsedFiles.length > 0
    }, {
      label: 'Clear Recently Used',
      enabled: recentlyUsedFiles.length > 0,
      click (menuItem, browserWindow) {
        actions.clearRecentlyUsed()
      }
    })
    fileMenu.submenu.push(recentlyUsedMenu)
  } else {
    fileMenu.submenu.push({
      role: 'recentdocuments',
      submenu: [
        {
          role: 'clearrecentdocuments'
        }
      ]
    })
  }

  fileMenu.submenu.push({
    type: 'separator'
  }, {
    label: 'Close Tab',
    accelerator: keybindings.getAccelerator('fileCloseTab'),
    click (menuItem, browserWindow) {
      actions.closeTab(browserWindow)
    }
  }, {
    type: 'separator'
  }, {
    label: 'Save',
    accelerator: keybindings.getAccelerator('fileSave'),
    click (menuItem, browserWindow) {
      actions.save(browserWindow)
    }
  }, {
    label: 'Save As...',
    accelerator: keybindings.getAccelerator('fileSaveAs'),
    click (menuItem, browserWindow) {
      actions.saveAs(browserWindow)
    }
  }, {
    label: 'Auto Save',
    type: 'checkbox',
    checked: autoSave,
    click (menuItem, browserWindow) {
      actions.autoSave(menuItem, browserWindow)
    }
  }, {
    type: 'separator'
  }, {
    label: 'Move To...',
    click (menuItem, browserWindow) {
      actions.moveTo(browserWindow)
    }
  }, {
    label: 'Rename...',
    click (menuItem, browserWindow) {
      actions.rename(browserWindow)
    }
  }, {
    type: 'separator'
  }, {
    label: 'Import...',
    click (menuItem, browserWindow) {
      actions.importFile(browserWindow)
    }
  }, {
    label: 'Export',
    submenu: [
      {
        label: 'HTML',
        click (menuItem, browserWindow) {
          actions.exportFile(browserWindow, 'styledHtml')
        }
      }, {
        label: 'PDF',
        click (menuItem, browserWindow) {
          actions.exportFile(browserWindow, 'pdf')
        }
      }
    ]
  }, {
    type: 'separator'
  }, {
    label: 'Print',
    accelerator: keybindings.getAccelerator('filePrint'),
    click (menuItem, browserWindow) {
      actions.print(browserWindow)
    }
  }, {
    type: 'separator',
    visible: notOsx
  }, {
    label: 'Preferences',
    accelerator: keybindings.getAccelerator('filePreferences'),
    visible: notOsx,
    click (menuItem, browserWindow) {
      userSetting(menuItem, browserWindow)
    }
  }, {
    type: 'separator',
    visible: notOsx
  }, {
    label: 'Quit',
    accelerator: keybindings.getAccelerator('fileQuit'),
    visible: notOsx,
    click: app.quit
  })

  return fileMenu
}
