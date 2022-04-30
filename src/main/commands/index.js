import COMMAND_CONSTANTS from 'common/commands/constants'
import { loadFileCommands } from './file'
import { loadTabCommands } from './tab'

export const COMMANDS = COMMAND_CONSTANTS

export const loadDefaultCommands = commandManager => {
  loadFileCommands(commandManager)
  loadTabCommands(commandManager)
}

class CommandManager {
  constructor () {
    this._commands = new Map()
  }

  add (id, callback) {
    const { _commands } = this
    if (_commands.has(id)) {
      throw new Error(`Command with id="${id}" already exists.`)
    }
    _commands.set(id, callback)
  }

  remove (id) {
    return this._commands.delete(id)
  }

  has (id) {
    return this._commands.has(id)
  }

  execute (id, ...args) {
    const command = this._commands.get(id)
    if (!command) {
      throw new Error(`No command found with id="${id}".`)
    }
    return command(...args)
  }

  __verifyDefaultCommands () {
    const { _commands } = this
    Object.keys(COMMANDS).forEach(propertyName => {
      const id = COMMANDS[propertyName]
      if (!_commands.has(id)) {
        console.error(`[DEBUG] Default command with id="${id}" isn't available!`)
      }
    })
  }
}

const commandManagerInstance = new CommandManager()
export { commandManagerInstance as CommandManager }
