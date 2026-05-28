import type { BrowserWindow } from 'electron'
import { COMMANDS, type CommandManager, type CommandCallback } from './index'

type MaybeWin = BrowserWindow | null | undefined

const switchToLeftTab = (win: MaybeWin): void => {
  if (win && win.webContents) {
    win.webContents.send('mt::tabs-cycle-left')
  }
}

const switchToRightTab = (win: MaybeWin): void => {
  if (win && win.webContents) {
    win.webContents.send('mt::tabs-cycle-right')
  }
}

const switchTabByIndex = (win: MaybeWin, index: number): void => {
  if (win && win.webContents) {
    win.webContents.send('mt::switch-tab-by-index', index)
  }
}

export const loadTabCommands = (commandManager: CommandManager): void => {
  commandManager.add(COMMANDS.TABS_CYCLE_BACKWARD, switchToLeftTab as CommandCallback)
  commandManager.add(COMMANDS.TABS_CYCLE_FORWARD, switchToRightTab as CommandCallback)
  commandManager.add(COMMANDS.TABS_SWITCH_TO_LEFT, switchToLeftTab as CommandCallback)
  commandManager.add(COMMANDS.TABS_SWITCH_TO_RIGHT, switchToRightTab as CommandCallback)
  commandManager.add(COMMANDS.TABS_SWITCH_TO_FIRST, ((win: MaybeWin) =>
    switchTabByIndex(win, 0)) as CommandCallback)
  commandManager.add(COMMANDS.TABS_SWITCH_TO_SECOND, ((win: MaybeWin) =>
    switchTabByIndex(win, 1)) as CommandCallback)
  commandManager.add(COMMANDS.TABS_SWITCH_TO_THIRD, ((win: MaybeWin) =>
    switchTabByIndex(win, 2)) as CommandCallback)
  commandManager.add(COMMANDS.TABS_SWITCH_TO_FOURTH, ((win: MaybeWin) =>
    switchTabByIndex(win, 3)) as CommandCallback)
  commandManager.add(COMMANDS.TABS_SWITCH_TO_FIFTH, ((win: MaybeWin) =>
    switchTabByIndex(win, 4)) as CommandCallback)
  commandManager.add(COMMANDS.TABS_SWITCH_TO_SIXTH, ((win: MaybeWin) =>
    switchTabByIndex(win, 5)) as CommandCallback)
  commandManager.add(COMMANDS.TABS_SWITCH_TO_SEVENTH, ((win: MaybeWin) =>
    switchTabByIndex(win, 6)) as CommandCallback)
  commandManager.add(COMMANDS.TABS_SWITCH_TO_EIGHTH, ((win: MaybeWin) =>
    switchTabByIndex(win, 7)) as CommandCallback)
  commandManager.add(COMMANDS.TABS_SWITCH_TO_NINTH, ((win: MaybeWin) =>
    switchTabByIndex(win, 8)) as CommandCallback)
  commandManager.add(COMMANDS.TABS_SWITCH_TO_TENTH, ((win: MaybeWin) =>
    switchTabByIndex(win, 9)) as CommandCallback)
}
