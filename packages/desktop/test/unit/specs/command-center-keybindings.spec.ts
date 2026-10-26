import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const mocks = vi.hoisted(() => ({
  ipc: new Map<string, (...args: unknown[]) => void>(),
  bus: new Map<string, (...args: unknown[]) => unknown>(),
  send: vi.fn(),
  descriptions: vi.fn(async() => [{ id: 'format.strong', description: 'Bold' }])
}))
vi.mock('@/store/editor', () => ({ useEditorStore: () => ({ currentFile: null }) }))
vi.mock('electron-log', () => ({ default: { error: vi.fn() } }))
vi.mock('@/util', () => ({ isMac: true }))
vi.mock('@/bus', () => ({
  default: {
    on: (event: string, handler: (...args: unknown[]) => unknown) => mocks.bus.set(event, handler)
  }
}))
vi.mock('@/commands', () => ({
  default: [],
  RootCommand: class {
    subcommands = []
  },
  getCommandsWithDescriptions: mocks.descriptions
}))
import { useCommandCenterStore } from '@/store/commandCenter'

beforeEach(() => {
  setActivePinia(createPinia())
  mocks.ipc.clear()
  mocks.bus.clear()
  mocks.send.mockClear()
  mocks.descriptions.mockImplementation(async() => [{ id: 'format.strong', description: 'Bold' }])
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        on: (event: string, handler: (...args: unknown[]) => void) => mocks.ipc.set(event, handler),
        send: mocks.send
      }
    }
  })
})

describe('command-center active keybindings', () => {
  it('subscribes before async descriptions load and applies the early snapshot', async() => {
    let finish!: (commands: Array<{ id: string; description: string }>) => void
    mocks.descriptions.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    const store = useCommandCenterStore()
    const initialization = store.LISTEN_COMMAND_CENTER_BUS()
    mocks.ipc.get('mt::keybindings-response')!(undefined, { 'format.strong': 'Command+Shift+B' })
    expect(mocks.send).toHaveBeenCalledWith('mt::request-keybindings')
    finish([{ id: 'format.strong', description: 'Bold' }])
    await initialization
    expect(store.rootCommand.subcommands[0].shortcut).toEqual(['⇧', '⌘', 'B'])
  })

  it('clears stale palette hints for empty and missing bindings', async() => {
    const store = useCommandCenterStore()
    await store.LISTEN_COMMAND_CENTER_BUS()
    store.UPDATE_KEYBINDINGS({ 'format.strong': 'Command+B' })
    expect(store.rootCommand.subcommands[0].shortcut).toEqual(['⌘', 'B'])
    store.UPDATE_KEYBINDINGS({ 'format.strong': '' })
    expect(store.rootCommand.subcommands[0].shortcut).toEqual([])
    store.UPDATE_KEYBINDINGS({ 'format.strong': 'F8' })
    store.UPDATE_KEYBINDINGS({})
    expect(store.rootCommand.subcommands[0].shortcut).toEqual([])
  })

  it('retains the active map across language changes and late command registration', async() => {
    const store = useCommandCenterStore()
    await store.LISTEN_COMMAND_CENTER_BUS()
    store.UPDATE_KEYBINDINGS({ 'format.strong': 'F8', 'custom.command': 'F9' })
    store.REGISTER_COMMAND({ id: 'custom.command', description: 'Custom' })
    await mocks.bus.get('language-changed')!()
    expect(
      store.rootCommand.subcommands.find((entry) => entry.id === 'format.strong')?.shortcut
    ).toEqual(['F8'])
    expect(
      store.rootCommand.subcommands.find((entry) => entry.id === 'custom.command')?.shortcut
    ).toEqual(['F9'])
    expect(store.getAccelerator('format.strong')).toBe('F8')
  })
})
