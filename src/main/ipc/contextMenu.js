import { ipcMain, BrowserWindow, Menu, MenuItem } from 'electron'

export function registerContextMenuHandlers() {
  ipcMain.handle('mt::show-context-menu', (event, menuTemplate) => {
    return new Promise((resolve) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      const menu = new Menu()
      for (const item of menuTemplate) {
        const menuItem = new MenuItem({
          label: String(item.label ?? ''),
          type: ['normal', 'separator', 'checkbox', 'radio'].includes(item.type) ? item.type : 'normal',
          enabled: item.enabled !== false,
          checked: !!item.checked,
          click: () => resolve(item.id)
        })
        menu.append(menuItem)
      }
      menu.popup({
        window: win,
        callback: () => resolve(null)
      })
    })
  })

  ipcMain.on('mt::show-app-menu', (event, x, y) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const menu = Menu.getApplicationMenu()
    if (menu && win) {
      menu.popup({ window: win, x, y })
    }
  })
}
