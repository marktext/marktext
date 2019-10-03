import { getMenuItemById } from '../../menu'

const typewriterModeMenuItemId = 'typewriterModeMenuItem'
const focusModeMenuItemId = 'focusModeMenuItem'

export const typeMode = (win, type, item) => {
  const { checked } = item
  win.webContents.send('AGANI::view', { type, checked })

  if (type === 'sourceCode') {
    const typewriterModeMenuItem = getMenuItemById(typewriterModeMenuItemId)
    const focusModeMenuItem = getMenuItemById(focusModeMenuItemId)
    typewriterModeMenuItem.enabled = !checked
    focusModeMenuItem.enabled = !checked
  }
}

export const layout = (item, win, type) => {
  win.webContents.send('AGANI::listen-for-view-layout', { [type]: item.checked })
}

export const showTabBar = win => {
  const tabBarMenuItem = getMenuItemById('tabBarMenuItem')
  if (tabBarMenuItem && !tabBarMenuItem.checked && tabBarMenuItem.click) {
    tabBarMenuItem.click(tabBarMenuItem, win)
  }
}

// --- IPC events -------------------------------------------------------------

// NOTE: Don't use static `getMenuItemById` here, instead request the menu by
//       window id from `AppMenu` manager.

export const viewLayoutChanged = (applicationMenu, { showSideBar, showTabBar }) => {
  const sideBarMenuItem = applicationMenu.getMenuItemById('sideBarMenuItem')
  const tabBarMenuItem = applicationMenu.getMenuItemById('tabBarMenuItem')
  sideBarMenuItem.checked = showSideBar
  tabBarMenuItem.checked = showTabBar
}
