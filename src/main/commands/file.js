import { COMMANDS } from './index'

const openQuickOpenDialog = win => {
  if (win && win.webContents) {
    win.webContents.send('mt::execute-command-by-id', 'file.quick-open')
  }
}

export const loadFileCommands = commandManager => {
  commandManager.add(COMMANDS.FILE_QUICK_OPEN, openQuickOpenDialog)
}
