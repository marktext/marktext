let viewMenu = {
  label: 'View',
  submenu: [{
    label: 'Toggle Full Screen',
    accelerator: (function () {
      if (process.platform === 'darwin') {
        return 'Ctrl+Command+F'
      } else {
        return 'F11'
      }
    })(),
    click: function (item, focusedWindow) {
      if (focusedWindow) {
        focusedWindow.setFullScreen(!focusedWindow.isFullScreen())
      }
    }
  }]
}

if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'development') {
  // add devtool when development
  viewMenu.submenu.push({
    label: 'Toggle Developer Tools',
    accelerator: (function () {
      if (process.platform === 'darwin') {
        return 'Alt+Command+I'
      } else {
        return 'Ctrl+Shift+I'
      }
    })(),
    click: function (item, focusedWindow) {
      if (focusedWindow) {
        focusedWindow.webContents.toggleDevTools()
      }
    }
  })
  // add reload when development
  viewMenu.submenu.push({
    label: 'Reload',
    accelerator: 'CmdOrCtrl+R',
    click: function (item, focusedWindow) {
      if (focusedWindow) {
        focusedWindow.reload()
      }
    }
  })
}

if (process.platform === 'darwin') {
  viewMenu.submenu.push({
    type: 'separator'
  }, {
    label: 'Bring All to Front',
    role: 'front'
  })
}

export default viewMenu
