import { loadEditCommands } from './edit'
import { loadFileCommands, type ManagedFileActionsProvider } from './file'
import { loadFormatCommands } from './format'
import { loadMarktextCommands } from './marktext'
import { loadParagraphCommands } from './paragraph'
import { loadViewCommands } from './view'
import { loadWindowCommands } from './window'
import type { CommandManager } from '../../commands'

export const loadMenuCommands = (
  commandManager: CommandManager,
  getManagedActions?: ManagedFileActionsProvider
): void => {
  loadEditCommands(commandManager)
  loadFileCommands(commandManager, getManagedActions)
  loadFormatCommands(commandManager)
  loadMarktextCommands(commandManager)
  loadParagraphCommands(commandManager)
  loadViewCommands(commandManager)
  loadWindowCommands(commandManager)
}
