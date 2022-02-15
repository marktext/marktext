import { ipcMain } from 'electron'
import { COMMANDS } from '../../commands'

const typewriterModeMenuItemId = 'typewriterModeMenuItem'
const focusModeMenuItemId = 'focusModeMenuItem'

const toggleTypeMode = (win, type) => {
  if (win && win.webContents) {
    win.webContents.send('mt::toggle-view-mode-entry', type)
  }
}

const setLayout = (win, type, value) => {
  if (win && win.webContents) {
    win.webContents.send('mt::set-view-layout', { [type]: value })
  }
}

const toggleLayout = (win, type) => {
  if (win && win.webContents) {
    win.webContents.send('mt::toggle-view-layout-entry', type)
  }
}

export const debugToggleDevTools = win => {
  if (win && global.MARKTEXT_DEBUG) {
    win.webContents.toggleDevTools()
  }
}

export const debugReloadWindow = win => {
  if (win && global.MARKTEXT_DEBUG) {
    ipcMain.emit('window-reload-by-id', win.id)
  }
}

export const showCommandPalette = win => {
  if (win && win.webContents) {
    win.webContents.send('mt::show-command-palette')
  }
}

export const toggleFocusMode = win => {
  toggleTypeMode(win, 'focus')
}

export const toggleSourceCodeMode = win => {
  toggleTypeMode(win, 'sourceCode')
}

export const toggleSidebar = win => {
  toggleLayout(win, 'showSideBar')
}

export const toggleTabBar = win => {
  toggleLayout(win, 'showTabBar')
}

export const showTabBar = win => {
  setLayout(win, 'showTabBar', true)
}

export const showTableOfContents = win => {
  setLayout(win, 'rightColumn', 'toc')
}

export const toggleTypewriterMode = win => {
  toggleTypeMode(win, 'typewriter')
}

export const reloadImageCache = win => {
  if (win && win.webContents) {
    win.webContents.send('mt::invalidate-image-cache')
  }
}

// --- Commands -------------------------------------------------------------

export const loadViewCommands = commandManager => {
  commandManager.add(COMMANDS.VIEW_COMMAND_PALETTE, showCommandPalette)
  commandManager.add(COMMANDS.VIEW_FOCUS_MODE, toggleFocusMode)
  commandManager.add(COMMANDS.VIEW_FORCE_RELOAD_IMAGES, reloadImageCache)
  commandManager.add(COMMANDS.VIEW_SOURCE_CODE_MODE, toggleSourceCodeMode)
  commandManager.add(COMMANDS.VIEW_TOGGLE_SIDEBAR, toggleSidebar)
  commandManager.add(COMMANDS.VIEW_TOGGLE_TABBAR, toggleTabBar)
  commandManager.add(COMMANDS.VIEW_TOGGLE_TOC, showTableOfContents)
  commandManager.add(COMMANDS.VIEW_TYPEWRITER_MODE, toggleTypewriterMode)

  commandManager.add(COMMANDS.VIEW_DEV_RELOAD, debugReloadWindow)
  commandManager.add(COMMANDS.VIEW_TOGGLE_DEV_TOOLS, debugToggleDevTools)
}

// --- IPC events -------------------------------------------------------------

// NOTE: Don't use static `getMenuItemById` here, instead request the menu by
//       window id from `AppMenu` manager.

/**
 *
 * @param {*} applicationMenu The application menu instance.
 * @param {*} changes Array of changed view settings (e.g. [ {showSideBar: true} ]).
 */
export const viewLayoutChanged = (applicationMenu, changes) => {
  const disableMenuByName = (id, value) => {
    const menuItem = applicationMenu.getMenuItemById(id)
    menuItem.enabled = value
  }
  const changeMenuByName = (id, value) => {
    const menuItem = applicationMenu.getMenuItemById(id)
    menuItem.checked = value
  }

  for (const key in changes) {
    const value = changes[key]
    switch (key) {
      case 'showSideBar':
        changeMenuByName('sideBarMenuItem', value)
        break
      case 'showTabBar':
        changeMenuByName('tabBarMenuItem', value)
        break
      case 'sourceCode':
        changeMenuByName('sourceCodeModeMenuItem', value)
        disableMenuByName(focusModeMenuItemId, !value)
        disableMenuByName(typewriterModeMenuItemId, !value)
        break
      case 'typewriter':
        changeMenuByName(typewriterModeMenuItemId, value)
        break
      case 'focus':
        changeMenuByName(focusModeMenuItemId, value)
        break
    }
  }
}
