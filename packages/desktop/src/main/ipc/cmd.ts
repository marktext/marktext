import { ipcMain } from 'electron'
import { ensureShellEnvPath } from '../app/envPath'
import { resolveCommandPath } from '../utils/resolveCommand'

export const registerCmdHandlers = (): void => {
  ipcMain.handle('mt::cmd::exists', async(_event, name: string) => {
    try {
      await ensureShellEnvPath()
      return resolveCommandPath(name) !== null
    } catch {
      return false
    }
  })
}
