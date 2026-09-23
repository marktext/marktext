import { ipcMain } from 'electron'
import { resolveCommand } from '../utils/resolveCommand'

export const registerCmdHandlers = (): void => {
  ipcMain.handle('mt::cmd::exists', async(_event, name: string) => {
    try {
      return (await resolveCommand(name)) !== null
    } catch {
      return false
    }
  })
}
