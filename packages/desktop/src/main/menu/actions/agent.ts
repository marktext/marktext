import type { BrowserWindow } from 'electron'
import { COMMANDS, type CommandManager, type CommandCallback } from '../../commands'

type Win = BrowserWindow | null | undefined

const forwardToRenderer = (id: string) => (win: Win): void => {
  if (win && win.webContents) {
    win.webContents.send('mt::execute-command-by-id', id)
  }
}

export const loadAgentCommands = (commandManager: CommandManager): void => {
  commandManager.add(COMMANDS.COMMENTS_COMMENT, forwardToRenderer(COMMANDS.COMMENTS_COMMENT) as CommandCallback)
  commandManager.add(
    COMMANDS.COMMENTS_SEND_SELECTED,
    forwardToRenderer(COMMANDS.COMMENTS_SEND_SELECTED) as CommandCallback
  )
  commandManager.add(
    COMMANDS.COMMENTS_SEND_ALL,
    forwardToRenderer(COMMANDS.COMMENTS_SEND_ALL) as CommandCallback
  )
  commandManager.add(
    COMMANDS.COMMENTS_NEXT_THREAD,
    forwardToRenderer(COMMANDS.COMMENTS_NEXT_THREAD) as CommandCallback
  )
  commandManager.add(
    COMMANDS.COMMENTS_PREVIOUS_THREAD,
    forwardToRenderer(COMMANDS.COMMENTS_PREVIOUS_THREAD) as CommandCallback
  )
}
