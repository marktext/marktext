import { app } from 'electron'
import * as actions from '../actions/file'
import { userSetting } from '../actions/marktext'
import userPreference from '../preference'

export default function (recentlyUsedFiles) {
  const { autoSave } = userPreference.getAll()
  const notOsx = process.platform !== 'darwin'
  let fileMenu = {
    label: 'File',
    submenu: [{
      label: 'New File',
      accelerator: 'CmdOrCtrl+N',
      click (menuItem, browserWindow) {
        actions.newFile()
      }
    }, {
      label: 'New Tab',
      accelerator: 'Shift+CmdOrCtrl+T',
      click (menuItem, browserWindow) {
        actions.newTab(browserWindow)
      }
    }, {
      type: 'separator'
    }, {
      label: 'Open File',
      accelerator: 'CmdOrCtrl+O',
      click (menuItem, browserWindow) {
        actions.open(browserWindow)
      }
    }, {
      label: 'Open Folder',
      accelerator: 'Shift+CmdOrCtrl+O',
      click (menuItem, browserWindow) {
        actions.openProject(browserWindow)
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
          actions.openFileOrProject(menuItem.label)
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
    accelerator: 'CmdOrCtrl+W',
    click (menuItem, browserWindow) {
      actions.closeTab(browserWindow)
    }
  }, {
    type: 'separator'
  }, {
    label: 'Save',
    accelerator: 'CmdOrCtrl+S',
    click (menuItem, browserWindow) {
      actions.save(browserWindow)
    }
  }, {
    label: 'Save As...',
    accelerator: 'Shift+CmdOrCtrl+S',
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
    label: 'Import',
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
    accelerator: 'CmdOrCtrl+P',
    click (menuItem, browserWindow) {
      actions.print(browserWindow)
    }
  }, {
    type: 'separator',
    visible: notOsx
  }, {
    label: 'Preferences',
    accelerator: 'Ctrl+,',
    visible: notOsx,
    click (menuItem, browserWindow) {
      userSetting(menuItem, browserWindow)
    }
  }, {
    type: 'separator',
    visible: notOsx
  }, {
    label: 'Quit',
    accelerator: 'Ctrl+Q',
    visible: notOsx,
    click: app.quit
  })

  return fileMenu
}
