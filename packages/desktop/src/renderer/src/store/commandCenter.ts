import { isReadingCommandAllowed } from 'common/commands/readingMode'
import { useEditorStore } from './editor'
import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import log from 'electron-log'
import bus from '../bus'
import { isMac } from '@/util'
import { acceleratorToTokens } from '@/util/accelerator'

import staticCommands, {
  RootCommand,
  getCommandsWithDescriptions,
  type CommandDescriptor
} from '../commands'

type Command = CommandDescriptor
type Root = { subcommands: Command[] }

export const useCommandCenterStore = defineStore('commandCenter', () => {
  const activeKeybindings = shallowRef<Readonly<Record<string, string>>>({})
  const registeredCommands = new Map<string, Command>()
  const rootCommand = ref<Root>(
    new RootCommand(staticCommands as unknown as CommandDescriptor[]) as Root
  )

  function REGISTER_COMMAND(command: Command): void {
    registeredCommands.set(command.id, command)
    command.shortcut = normalizeAccelerator(getAccelerator(command.id) ?? '')
    const index = rootCommand.value.subcommands.findIndex((entry) => entry.id === command.id)
    if (index === -1) rootCommand.value.subcommands.push(command)
    else rootCommand.value.subcommands[index] = command
  }

  function getAccelerator(commandId: string): string | undefined {
    return activeKeybindings.value[commandId]
  }

  function applyShortcuts(): void {
    for (const entry of rootCommand.value.subcommands) {
      entry.shortcut = normalizeAccelerator(getAccelerator(entry.id) ?? '')
    }
  }

  function UPDATE_KEYBINDINGS(bindings: Readonly<Record<string, string>>): void {
    activeKeybindings.value = { ...bindings }
    applyShortcuts()
  }

  async function refreshCommands(): Promise<void> {
    const commands = await getCommandsWithDescriptions()
    rootCommand.value.subcommands = [
      ...commands.filter((entry) => !registeredCommands.has(entry.id)),
      ...registeredCommands.values()
    ]
    applyShortcuts()
    SORT_COMMANDS()
  }

  function SORT_COMMANDS(): void {
    rootCommand.value.subcommands.sort((a, b) =>
      (a.description ?? '').localeCompare(b.description ?? '')
    )
  }

  async function LISTEN_COMMAND_CENTER_BUS(): Promise<void> {
    window.electron.ipcRenderer.on('mt::keybindings-response', (_e, keybindingMap) => {
      UPDATE_KEYBINDINGS(keybindingMap)
    })
    window.electron.ipcRenderer.send('mt::request-keybindings')

    bus.on('language-changed', async() => {
      await refreshCommands()
    })

    bus.on('cmd::sort-commands', () => {
      SORT_COMMANDS()
    })

    bus.on('cmd::register-command', (command: unknown) => {
      REGISTER_COMMAND(command as Command)
    })

    bus.on('cmd::execute', (commandId: unknown) => {
      executeCommand(rootCommand.value, String(commandId))
    })
    window.electron.ipcRenderer.on('mt::execute-command-by-id', (_e, commandId) => {
      executeCommand(rootCommand.value, String(commandId))
    })
    await refreshCommands()
  }

  return {
    rootCommand,
    activeKeybindings,
    getAccelerator,
    UPDATE_KEYBINDINGS,
    REGISTER_COMMAND,
    SORT_COMMANDS,
    LISTEN_COMMAND_CENTER_BUS
  }
})

const executeCommand = (root: Root, commandId: string): void => {
  if (useEditorStore().currentFile?.readOnly && !isReadingCommandAllowed(commandId)) return
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
    return acceleratorToTokens(acc, isMac)
  } catch {
    return [acc]
  }
}
