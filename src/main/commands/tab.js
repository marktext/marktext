import { COMMANDS } from './index'

const switchToLeftTab = win => {
  if (win && win.webContents) {
    win.webContents.send('mt::tabs-cycle-left')
  }
}

const switchToRightTab = win => {
  if (win && win.webContents) {
    win.webContents.send('mt::tabs-cycle-right')
  }
}

const switchTabByIndex = (win, index) => {
  if (win && win.webContents) {
    win.webContents.send('mt::switch-tab-by-index', index)
  }
}

export const loadTabCommands = commandManager => {
  commandManager.add(COMMANDS.TABS_CYCLE_BACKWARD, switchToLeftTab)
  commandManager.add(COMMANDS.TABS_CYCLE_FORWARD, switchToRightTab)
  commandManager.add(COMMANDS.TABS_SWITCH_TO_LEFT, switchToLeftTab)
  commandManager.add(COMMANDS.TABS_SWITCH_TO_RIGHT, switchToRightTab)
  commandManager.add(COMMANDS.TABS_SWITCH_TO_FIRST, win => switchTabByIndex(win, 0))
  commandManager.add(COMMANDS.TABS_SWITCH_TO_SECOND, win => switchTabByIndex(win, 1))
  commandManager.add(COMMANDS.TABS_SWITCH_TO_THIRD, win => switchTabByIndex(win, 2))
  commandManager.add(COMMANDS.TABS_SWITCH_TO_FOURTH, win => switchTabByIndex(win, 3))
  commandManager.add(COMMANDS.TABS_SWITCH_TO_FIFTH, win => switchTabByIndex(win, 4))
  commandManager.add(COMMANDS.TABS_SWITCH_TO_SIXTH, win => switchTabByIndex(win, 5))
  commandManager.add(COMMANDS.TABS_SWITCH_TO_SEVENTH, win => switchTabByIndex(win, 6))
  commandManager.add(COMMANDS.TABS_SWITCH_TO_EIGHTH, win => switchTabByIndex(win, 7))
  commandManager.add(COMMANDS.TABS_SWITCH_TO_NINTH, win => switchTabByIndex(win, 8))
  commandManager.add(COMMANDS.TABS_SWITCH_TO_TENTH, win => switchTabByIndex(win, 9))
}
