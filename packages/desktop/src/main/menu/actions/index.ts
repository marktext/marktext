import { loadEditCommands } from './edit'
import { loadFileCommands } from './file'
import { loadFormatCommands } from './format'
import { loadMarktextCommands } from './marktext'
import { loadParagraphCommands } from './paragraph'
import { loadViewCommands } from './view'
import { loadWindowCommands } from './window'
import type { CommandManager } from '../../commands'
import type Preference from '../../preferences'

export const loadMenuCommands = (
  commandManager: CommandManager,
  preferences: Preference
): void => {
  loadEditCommands(commandManager)
  loadFileCommands(commandManager)
  loadFormatCommands(commandManager)
  loadMarktextCommands(commandManager)
  loadParagraphCommands(commandManager)
  loadViewCommands(commandManager)
  loadWindowCommands(commandManager, preferences)
}
