import COMMAND_CONSTANTS, { type CommandId } from 'common/commands/constants'
import { loadFileCommands } from './file'
import { loadTabCommands } from './tab'

export const COMMANDS = COMMAND_CONSTANTS

// CommandCallback is intentionally loose: registered command handlers vary
// widely in their signatures (some take a BrowserWindow, some take nothing,
// some take a string id, etc.). Mirrors the JS reality where callsites
// passed any function shape and the manager just invoked it. A single non-`any`
// type cannot both accept every typed handler (contravariant params) and stay
// callable with real args, so this stays an explicit, documented escape hatch.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CommandCallback = (...args: any[]) => any

export const loadDefaultCommands = (commandManager: CommandManager): void => {
  loadFileCommands(commandManager)
  loadTabCommands(commandManager)
}

class CommandManagerClass {
  private _commands: Map<string, CommandCallback>

  constructor() {
    this._commands = new Map()
  }

  add(id: string, callback: CommandCallback): void {
    const { _commands } = this
    if (_commands.has(id)) {
      throw new Error(`Command with id="${id}" already exists.`)
    }
    _commands.set(id, callback)
  }

  remove(id: string): boolean {
    return this._commands.delete(id)
  }

  has(id: string): boolean {
    return this._commands.has(id)
  }

  execute(id: string, ...args: unknown[]): unknown {
    const command = this._commands.get(id)
    if (!command) {
      throw new Error(`No command found with id="${id}".`)
    }
    return command(...args)
  }

  __verifyDefaultCommands(): void {
    const { _commands } = this
    Object.keys(COMMANDS).forEach((propertyName) => {
      const id = (COMMANDS as Record<string, CommandId>)[propertyName]
      if (!_commands.has(id)) {
        console.error(`[DEBUG] Default command with id="${id}" isn't available!`)
      }
    })
  }
}

// Mirror the JS module shape: `CommandManager` is a singleton instance at
// the value level AND a type alias at the type level.
export type CommandManager = CommandManagerClass
const commandManagerInstance = new CommandManagerClass()
export { commandManagerInstance as CommandManager }
