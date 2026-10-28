import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useKeybindingsStore } from '@/store/keybindings'

const { notify } = vi.hoisted(() => ({ notify: vi.fn() }))
vi.mock('@/services/notification', () => ({ default: { notify } }))
vi.mock('electron-log', () => ({ default: { error: vi.fn() } }))
vi.mock('common/localShortcut', () => ({ setKeyboardLayout: vi.fn() }))
vi.mock('@/util', () => ({ isMac: true }))
vi.mock('@/i18n', async() => {
  const { ref } = await import('vue')
  return { t: (key: string) => key, i18n: { global: { locale: ref('en') } } }
})

const boot = async() => {
  setActivePinia(createPinia())
  notify.mockClear()
  const save = vi.fn().mockResolvedValue(true)
  const invoke = vi.fn(async(channel: string, bindings?: unknown) => {
    if (channel === 'mt::keybinding-get-keyboard-info') return { layout: {}, keymap: {} }
    if (channel === 'mt::keybinding-get-pref-keybindings') return {
      defaultKeybindings: new Map([['file.save', 'Ctrl+S'], ['file.open-file', 'Ctrl+O']]),
      userKeybindings: new Map([['file.save', 'Ctrl+Alt+S']])
    }
    if (channel === 'mt::keybinding-save-user-keybindings') return save(bindings)
    throw new Error(channel)
  })
  vi.stubGlobal('electron', { ipcRenderer: { invoke } })
  const store = useKeybindingsStore()
  await Promise.all([store.ensureLoaded(), store.ensureLoaded()])
  return { store, save, invoke }
}
afterEach(() => vi.unstubAllGlobals())

describe('shared shortcut persistence and search data', () => {
  it('loads once before opening the shortcut page and persists a confirmed edit', async() => {
    const { store, save, invoke } = await boot()
    expect(invoke.mock.calls.filter(([channel]) => channel === 'mt::keybinding-get-pref-keybindings')).toHaveLength(1)
    await store.change('file.save', 'Ctrl+Shift+S')
    expect(save).toHaveBeenCalledWith(new Map([['file.save', 'Ctrl+Shift+S']]))
    expect(store.commands.find(command => command.id === 'file.save')?.accelerator).toBe('Ctrl+Shift+S')
  })
  it('persists unbinding, resetting a single shortcut and restoring all defaults', async() => {
    const { store, save } = await boot()
    await store.unbind('file.save')
    expect(save).toHaveBeenLastCalledWith(new Map([['file.save', '']]))
    await store.reset('file.save')
    expect(save).toHaveBeenLastCalledWith(new Map())
    await store.change('file.save', 'Ctrl+Shift+S')
    await store.resetAll()
    expect(save).toHaveBeenLastCalledWith(new Map())
  })
  it('treats an equivalent default combination as unchanged', async() => {
    const { store, save } = await boot()
    expect(store.hasCustomBindings).toBe(true)
    await store.change('file.save', 'Control+S')
    expect(store.hasCustomBindings).toBe(false)
    expect(store.commands.find(command => command.id === 'file.save')?.accelerator).toBe('Ctrl+S')
    expect(save).toHaveBeenLastCalledWith(new Map())
    await store.unbind('file.save')
    expect(store.hasCustomBindings).toBe(true)
    await store.resetAll()
    expect(store.hasCustomBindings).toBe(false)
  })
  it('rejects conflicts without saving and accepts a command’s own binding', async() => {
    const { store, save } = await boot()
    await store.change('file.save', 'Ctrl+O')
    expect(save).not.toHaveBeenCalled()
    expect(store.conflict?.commands.map(command => command.id)).toEqual(['file.open-file'])
    expect(store.commands.find(command => command.id === 'file.save')?.accelerator).toBe('Ctrl+Alt+S')
    await store.change('file.save', 'Ctrl+Alt+S')
    expect(save).toHaveBeenCalledOnce()
  })
  it('prevents overlapping saves and publishes search data only after acknowledgement', async() => {
    const { store, save } = await boot()
    let finish: (success: boolean) => void = () => {}
    save.mockImplementationOnce(() => new Promise<boolean>(resolve => { finish = resolve }))
    const pending = store.unbind('file.save')
    expect(store.saving).toBe(true)
    await store.reset('file.save')
    await store.resetAll()
    expect(save).toHaveBeenCalledOnce()
    expect(store.commands.find(command => command.id === 'file.save')?.accelerator).toBe('Ctrl+Alt+S')
    finish(true)
    await pending
    expect(store.commands.find(command => command.id === 'file.save')?.accelerator).toBe('')
  })
  it.each(['false', 'rejected'])('restores confirmed bindings after a %s save', async(failure) => {
    const { store, save } = await boot()
    if (failure === 'false') save.mockResolvedValueOnce(false)
    else save.mockRejectedValueOnce(new Error('IPC failure'))
    await store.unbind('file.save')
    expect(store.commands.find(command => command.id === 'file.save')?.accelerator).toBe('Ctrl+Alt+S')
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))
    expect(store.saving).toBe(false)
    await store.unbind('file.save')
    expect(save).toHaveBeenCalledTimes(2)
  })
})
