import type { BrowserWindow } from 'electron'
import { COMMANDS, type CommandManager, type CommandCallback } from './index'

const openQuickOpenDialog = (win: BrowserWindow | null | undefined): void => {
  if (win && win.webContents) {
    win.webContents.send('mt::execute-command-by-id', 'file.quick-open')
  }
}

const openQuickOpenRecentDialog = (win: BrowserWindow | null | undefined): void => {
  if (win && win.webContents) {
    win.webContents.send('mt::execute-command-by-id', 'file.quick-open-recent')
  }
}

export const loadFileCommands = (commandManager: CommandManager): void => {
  commandManager.add(COMMANDS.FILE_QUICK_OPEN, openQuickOpenDialog as CommandCallback)
  commandManager.add(COMMANDS.FILE_QUICK_OPEN_RECENT, openQuickOpenRecentDialog as CommandCallback)
}
