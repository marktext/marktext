import { BrowserWindow, ipcMain } from 'electron'
import { isDirectory } from 'common/filesystem'
import * as pty from 'node-pty'
import os from 'os'

const terminals = new Map()

export const openInTerminal = async (win, pathname) => {
  if (!pathname || !(await isDirectory(pathname))) {
    return
  }

  // 发送打开内嵌终端的消息
  win.webContents.send('mt::show-terminal', pathname)
}

// 注册所有IPC处理器
export const registerTerminalActionHandlers = () => {
  // 处理传统的终端打开请求
  ipcMain.on('mt::open-in-terminal', (e, pathname) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    openInTerminal(win, pathname)
  })

  // 处理创建新终端的请求
  ipcMain.on('terminal:create', (event, { cwd }) => {
    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash'
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: cwd,
      env: process.env
    })

    const terminalId = event.sender.id
    terminals.set(terminalId, ptyProcess)

    // 处理终端数据输出
    ptyProcess.onData(data => {
      event.sender.send('terminal:output', data)
    })

    // 处理终端错误
    ptyProcess.onExit(() => {
      terminals.delete(terminalId)
      event.sender.send('terminal:exit')
    })
  })

  // 处理终端输入
  ipcMain.on('terminal:input', (event, data) => {
    const ptyProcess = terminals.get(event.sender.id)
    if (ptyProcess) {
      ptyProcess.write(data)
    }
  })

  // 处理终端关闭
  ipcMain.on('terminal:close', (event) => {
    const ptyProcess = terminals.get(event.sender.id)
    if (ptyProcess) {
      ptyProcess.kill()
      terminals.delete(event.sender.id)
    }
  })
}
