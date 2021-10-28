import { ipcMain } from 'electron'

export default function (keybindings) {
  const viewMenu = {
    label: '&Develop',
    submenu: [{
      label: 'Show Developer Tools',
      accelerator: keybindings.getAccelerator('view.toggle-dev-tools'),
      click (item, focusedWindow) {
        if (focusedWindow) {
          focusedWindow.webContents.toggleDevTools()
        }
      }
    },
    {
      label: 'Reload',
      accelerator: keybindings.getAccelerator('view.dev-reload'),
      click (item, focusedWindow) {
        if (focusedWindow) {
          ipcMain.emit('window-reload-by-id', focusedWindow.id)
        }
      }
    }]
  }
  return viewMenu
}
