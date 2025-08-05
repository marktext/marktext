import { BrowserWindow, ipcMain, shell } from 'electron'
import { isDirectory } from 'common/filesystem'

export const openInTerminal = async (win, pathname) => {
  if (!pathname || !(await isDirectory(pathname))) {
    return
  }

  // 在不同操作系统上打开终端的命令
  const commands = {
    darwin: `open -a Terminal "${pathname}"`,
    linux: `x-terminal-emulator --working-directory="${pathname}"`,
    win32: `start cmd /K "cd /d "${pathname}""`
  }

  const command = commands[process.platform]
  if (command) {
    shell.exec(command)
  }
}

// 注册IPC处理器
export const registerTerminalActionHandlers = () => {
  ipcMain.on('mt::open-in-terminal', (e, pathname) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    openInTerminal(win, pathname)
  })
}
