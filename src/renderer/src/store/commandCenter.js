import { defineStore } from 'pinia'
import log from 'electron-log'
import bus from '../bus'
import staticCommands, { RootCommand, getCommandsWithDescriptions } from '../commands'

export const useCommandCenterStore = defineStore('commandCenter', {
  state: () => ({
    rootCommand: new RootCommand(staticCommands)
  }),
  actions: {
    REGISTER_COMMAND(command) {
      this.rootCommand.subcommands.push(command)
    },
    SORT_COMMANDS() {
      this.rootCommand.subcommands.sort((a, b) => a.description.localeCompare(b.description))
    },
    async LISTEN_COMMAND_CENTER_BUS() {
      this.rootCommand.subcommands = await getCommandsWithDescriptions()
      this.SORT_COMMANDS()

      // Listen for language changes and initialize/update command descriptions
      bus.on('language-changed', async() => {
        // Update all command descriptions when language changes
        this.rootCommand.subcommands = await getCommandsWithDescriptions()
        this.SORT_COMMANDS()
      })

      // Init stuff
      bus.on('cmd::sort-commands', () => {
        this.SORT_COMMANDS()
      })
      window.electron.ipcRenderer.on('mt::keybindings-response', (e, keybindingMap) => {
        const { subcommands } = this.rootCommand
        for (const entry of subcommands) {
          const value = keybindingMap[entry.id]
          if (value) {
            entry.shortcut = normalizeAccelerator(value)
          }
        }
      })

      // Register commands that are created at runtime.
      bus.on('cmd::register-command', (command) => {
        this.REGISTER_COMMAND(command)
      })

      // Allow other compontents to execute commands with predefined values.
      bus.on('cmd::execute', (commandId) => {
        executeCommand(this, commandId)
      })
      window.electron.ipcRenderer.on('mt::execute-command-by-id', (e, commandId) => {
        executeCommand(this, commandId)
      })
    }
  }
})

const executeCommand = (store, commandId) => {
  const { subcommands } = store.rootCommand
  const command = subcommands.find((c) => c.id === commandId)
  if (!command) {
    const errorMsg = `Cannot execute command "${commandId}" because it's missing.`
    log.error(errorMsg)
    throw new Error(errorMsg)
  }
  command.execute()
}

const normalizeAccelerator = (acc) => {
  try {
    return acc
      .replace(/cmdorctrl|cmd/i, 'Cmd')
      .replace(/ctrl/i, 'Ctrl')
      .split('+')
  } catch (_) {
    return [acc]
  }
}
