import { ipcMain } from 'electron'
import log from 'electron-log'
import { resolveCommand } from '../utils/resolveCommand'
import { resolvePandocCommand } from '../utils/pandoc'
import type { PandocCommandInfo } from '@shared/types/pandoc'

export const registerCmdHandlers = (): void => {
  ipcMain.handle('mt::cmd::exists', async(_event, name: string) => {
    try {
      return (await resolveCommand(name)) !== null
    } catch {
      return false
    }
  })

  // Report the binary an export would spawn, which `mt::cmd::exists` cannot name (#2751).
  ipcMain.handle('mt::pandoc::command', async(): Promise<PandocCommandInfo> => {
    try {
      return await resolvePandocCommand()
    } catch (error) {
      // The pane draws no status line when this rejects, so a failed lookup answers "no pandoc".
      log.error('Failed to resolve the pandoc command:', error)
      return { command: null }
    }
  })
}
