import { ref } from 'vue'
import { defineStore } from 'pinia'
import log from 'electron-log'
import bus from '../bus'
import { isOsx } from '@/util'
import { acceleratorToTokens } from '@/util/accelerator'

import staticCommands, {
  RootCommand,
  getCommandsWithDescriptions,
  type CommandDescriptor
} from '../commands'

type Command = CommandDescriptor
type Root = { subcommands: Command[] }

export const useCommandCenterStore = defineStore('commandCenter', () => {
  const rootCommand = ref<Root>(
    new RootCommand(staticCommands as unknown as CommandDescriptor[]) as Root
  )

  function REGISTER_COMMAND(command: Command): void {
    rootCommand.value.subcommands.push(command)
  }

  function SORT_COMMANDS(): void {
    rootCommand.value.subcommands.sort((a, b) =>
      (a.description ?? '').localeCompare(b.description ?? '')
    )
  }

  async function LISTEN_COMMAND_CENTER_BUS(): Promise<void> {
    rootCommand.value.subcommands = await getCommandsWithDescriptions()
    SORT_COMMANDS()

    // Listen for language changes and update command descriptions.
    bus.on('language-changed', async() => {
      rootCommand.value.subcommands = await getCommandsWithDescriptions()
      SORT_COMMANDS()
    })

    bus.on('cmd::sort-commands', () => {
      SORT_COMMANDS()
    })

    window.electron.ipcRenderer.on('mt::keybindings-response', (_e, keybindingMap) => {
      const map = keybindingMap as Record<string, string>
      const { subcommands } = rootCommand.value
      for (const entry of subcommands) {
        const value = map[entry.id]
        if (value) {
          entry.shortcut = normalizeAccelerator(value)
        }
      }
    })

    // Register commands that are created at runtime.
    bus.on('cmd::register-command', (command: unknown) => {
      REGISTER_COMMAND(command as Command)
    })

    // Allow other components to execute commands with predefined values.
    bus.on('cmd::execute', (commandId: unknown) => {
      executeCommand(rootCommand.value, String(commandId))
    })
    window.electron.ipcRenderer.on('mt::execute-command-by-id', (_e, commandId) => {
      executeCommand(rootCommand.value, String(commandId))
    })
  }

  return {
    rootCommand,
    REGISTER_COMMAND,
    SORT_COMMANDS,
    LISTEN_COMMAND_CENTER_BUS
  }
})

const executeCommand = (root: Root, commandId: string): void => {
  const { subcommands } = root
  const command = subcommands.find((c) => c.id === commandId)
  if (!command) {
    const errorMsg = `Cannot execute command "${commandId}" because it's missing.`
    log.error(errorMsg)
    throw new Error(errorMsg)
  }
  command.execute?.()
}

const normalizeAccelerator = (acc: string): string[] => {
  try {
    return acceleratorToTokens(acc, isOsx)
  } catch {
    return [acc]
  }
}
