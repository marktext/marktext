import { ipcRenderer } from 'electron'
import log from 'electron-log'
import bus from '../bus'
import staticCommands, { RootCommand } from '../commands'

const state = {
  rootCommand: new RootCommand(staticCommands)
}

const getters = {}

const mutations = {
  REGISTER_COMMAND (state, command) {
    state.rootCommand.subcommands.push(command)
  },
  SORT_COMMANDS (state) {
    state.rootCommand.subcommands.sort((a, b) => a.description.localeCompare(b.description))
  }
}

const actions = {
  LISTEN_COMMAND_CENTER_BUS ({ commit, state }) {
    // Init stuff
    bus.$on('cmd::sort-commands', () => {
      commit('SORT_COMMANDS')
    })
    ipcRenderer.on('mt::keybindings-response', (e, keybindingMap) => {
      const { subcommands } = state.rootCommand
      for (const entry of subcommands) {
        const value = keybindingMap[entry.id]
        if (value) {
          entry.shortcut = normalizeAccelerator(value)
        }
      }
    })

    // Register commands that are created at runtime.
    bus.$on('cmd::register-command', command => {
      commit('REGISTER_COMMAND', command)
    })

    // Allow other compontents to execute commands with predefined values.
    bus.$on('cmd::execute', commandId => {
      executeCommand(state, commandId)
    })
    ipcRenderer.on('mt::execute-command-by-id', (e, commandId) => {
      executeCommand(state, commandId)
    })
  }
}

const executeCommand = (state, commandId) => {
  const { subcommands } = state.rootCommand
  const command = subcommands.find(c => c.id === commandId)
  if (!command) {
    const errorMsg = `Cannot execute command "${commandId}" because it's missing.`
    log.error(errorMsg)
    throw new Error(errorMsg)
  }
  command.execute()
}

const normalizeAccelerator = acc => {
  try {
    return acc
      .replace(/cmdorctrl|cmd/i, 'Cmd')
      .replace(/ctrl/i, 'Ctrl')
      .split('+')
  } catch (_) {
    return [acc]
  }
}

export default { state, getters, mutations, actions }
