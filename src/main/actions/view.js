import { ipcMain, BrowserWindow } from 'electron'
import { getMenuItemById } from '../utils'

const sourceCodeModeMenuItemId = 'sourceCodeModeMenuItem'
const typewriterModeMenuItemId = 'typewriterModeMenuItem'
const focusModeMenuItemId = 'focusModeMenuItem'

export const typeMode = (win, item, type) => {
  const { checked } = item
  win.webContents.send('AGANI::view', { type, checked })

  if (type === 'sourceCode') {
    const typewriterModeMenuItem = getMenuItemById(typewriterModeMenuItemId)
    const focusModeMenuItem = getMenuItemById(focusModeMenuItemId)
    typewriterModeMenuItem.enabled = !checked
    focusModeMenuItem.enabled = !checked
  }
}

export const changeFont = win => {
  win.webContents.send('AGANI::font-setting')
}

export const layout = (item, win, type) => {
  win.webContents.send('AGANI::listen-for-view-layout', { [type]: item.checked })
}

ipcMain.on('AGANI::ask-for-mode', e => {
  const sourceCodeModeMenuItem = getMenuItemById(sourceCodeModeMenuItemId)
  const typewriterModeMenuItem = getMenuItemById(typewriterModeMenuItemId)
  const focusModeMenuItem = getMenuItemById(focusModeMenuItemId)
  const modes = {
    sourceCode: sourceCodeModeMenuItem.checked,
    typewriter: typewriterModeMenuItem.checked,
    focus: focusModeMenuItem.checked
  }
  const win = BrowserWindow.fromWebContents(e.sender)
  win.webContents.send('AGANI::res-for-mode', modes)
})

ipcMain.on('AGANI::set-view-layout', (e, { showSideBar, showTabBar }) => {
  const sideBarMenuItem = getMenuItemById('sideBarMenuItem')
  const tabBarMenuItem = getMenuItemById('tabBarMenuItem')

  sideBarMenuItem.checked = showSideBar
  tabBarMenuItem.checked = showTabBar
})
