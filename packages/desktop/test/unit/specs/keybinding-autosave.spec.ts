import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { parse, compileScript } from 'vue/compiler-sfc'
import { ref } from 'vue'
import ts from 'typescript'
import KeybindingConfigurator from '@/prefComponents/keybindings/KeybindingConfigurator'
import type { UiKeybinding } from '@/prefComponents/keybindings/KeybindingConfigurator'

vi.mock('@/commands/descriptions', () => ({ default: (id: string) => id }))
vi.mock('@/util', () => ({ isMac: true }))

interface Bindings {
  keybindingConfigurator: { value: KeybindingConfigurator | null }
  selectedShortcutId: { value: string | null }
  isSaving: { value: boolean }
  onKeybinding: (value: string | null) => void
  handleResetClick: (index: number, entry: UiKeybinding) => void
  handleUnbindClick: (index: number, entry: UiKeybinding) => void
  restoreDefaults: () => void
}

// The unit runner has no Vue SFC plugin; execute the real setup with Vue refs
// and the real configurator, replacing only the surrounding UI services.
const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)),
  '../../../src/renderer/src/prefComponents/keybindings/index.vue'), 'utf8')
const { descriptor } = parse(source)
const compiled = compileScript(descriptor, { id: 'keybinding-autosave' })
const syntax = ts.createSourceFile('keybindings.ts', compiled.content, ts.ScriptTarget.Latest, true)
const noImports = syntax.statements
  .filter((statement) => !ts.isImportDeclaration(statement))
  .map((statement) => statement.getFullText(syntax))
  .join('\n')
const js = ts.transpileModule(noImports, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText
const factory = new Function('__deps', 'exports', 'module', `
  const { _defineComponent, ref, onMounted, onUnmounted, watch, useI18n,
    log, notice, KeybindingConfigurator, setKeyboardLayout, Separator,
    KeyInputDialog, Edit, RefreshRight, Delete, LinkIcon, IconTooltip } = __deps
  ${js}
  return module.exports
`) as (deps: Record<string, unknown>, exports: object, module: object) => {
  default: { setup: (props: object, ctx: { expose: () => void }) => Bindings }
}

const boot = () => {
  const invoke = vi.fn().mockResolvedValue(true)
  vi.stubGlobal('electron', { ipcRenderer: { invoke } })
  const notify = vi.fn()
  const logError = vi.fn()
  const module = { exports: {} }
  const component = factory({
    _defineComponent: (options: unknown) => options,
    ref,
    onMounted: () => {},
    onUnmounted: () => {},
    watch: () => {},
    useI18n: () => ({ t: (key: string) => key, locale: ref('en') }),
    log: { error: logError },
    notice: { notify },
    KeybindingConfigurator
  }, module.exports, module).default
  const bindings = component.setup({}, { expose: () => {} })
  bindings.keybindingConfigurator.value = new KeybindingConfigurator(
    new Map([['file.save', 'Ctrl+S'], ['file.open', 'Ctrl+O']]),
    new Map([['file.save', 'Ctrl+Alt+S']])
  )
  const entry = bindings.keybindingConfigurator.value.getKeybindings()
    .find((entry) => entry.id === 'file.save')
  if (!entry) throw new Error('Missing save shortcut')
  return { bindings, invoke, notify, logError, entry }
}

afterEach(() => vi.unstubAllGlobals())

describe('keybinding settings autosave', () => {
  it('persists a confirmed edit without a separate save action', async() => {
    const { bindings, invoke } = boot()
    bindings.selectedShortcutId.value = 'file.save'
    bindings.onKeybinding('Ctrl+Shift+S')
    await vi.waitFor(() => expect(bindings.isSaving.value).toBe(false))
    expect(invoke).toHaveBeenCalledWith('mt::keybinding-save-user-keybindings',
      new Map([['file.save', 'Ctrl+Shift+S']]))
    expect(bindings.selectedShortcutId.value).toBeNull()
  })

  it('persists unbinding and resetting a single shortcut', async() => {
    const { bindings, invoke, entry } = boot()
    bindings.handleUnbindClick(0, entry)
    await vi.waitFor(() => expect(bindings.isSaving.value).toBe(false))
    expect(invoke).toHaveBeenLastCalledWith('mt::keybinding-save-user-keybindings',
      new Map([['file.save', '']]))
    bindings.handleResetClick(0, entry)
    await vi.waitFor(() => expect(bindings.isSaving.value).toBe(false))
    expect(invoke).toHaveBeenLastCalledWith('mt::keybinding-save-user-keybindings', new Map())
  })

  it('persists restoring all defaults', async() => {
    const { bindings, invoke } = boot()
    bindings.restoreDefaults()
    await vi.waitFor(() => expect(bindings.isSaving.value).toBe(false))
    expect(invoke).toHaveBeenCalledWith('mt::keybinding-save-user-keybindings', new Map())
  })

  it('rejects conflicts and ignores cancelled edits without saving', () => {
    const { bindings, invoke, notify, entry } = boot()
    bindings.selectedShortcutId.value = 'file.save'
    bindings.onKeybinding('Ctrl+O')
    expect(entry.accelerator).toBe('Ctrl+Alt+S')
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'warning' }))
    bindings.selectedShortcutId.value = 'file.save'
    bindings.onKeybinding(null)
    expect(invoke).not.toHaveBeenCalled()
  })

  it('accepts the existing shortcut without reporting a conflict', async() => {
    const { bindings, notify } = boot()
    bindings.selectedShortcutId.value = 'file.save'
    bindings.onKeybinding('Ctrl+Alt+S')
    await vi.waitFor(() => expect(bindings.isSaving.value).toBe(false))
    expect(notify).not.toHaveBeenCalled()
  })

  it('prevents overlapping saves until the current write finishes', async() => {
    const { bindings, invoke, entry } = boot()
    let finish!: (success: boolean) => void
    invoke.mockImplementationOnce(() => new Promise<boolean>((resolve) => { finish = resolve }))
    bindings.handleUnbindClick(0, entry)
    expect(bindings.isSaving.value).toBe(true)
    bindings.handleResetClick(0, entry)
    bindings.restoreDefaults()
    expect(invoke).toHaveBeenCalledTimes(1)
    expect(entry.accelerator).toBe('')
    finish(true)
    await vi.waitFor(() => expect(bindings.isSaving.value).toBe(false))
    bindings.handleResetClick(0, entry)
    await vi.waitFor(() => expect(bindings.isSaving.value).toBe(false))
    expect(invoke).toHaveBeenCalledTimes(2)
  })

  it.each(['false', 'rejected'])('reports a %s save and allows retrying', async(failure) => {
    const { bindings, invoke, notify, entry } = boot()
    if (failure === 'false') invoke.mockResolvedValueOnce(false)
    else invoke.mockRejectedValueOnce(new Error('IPC failure'))
    bindings.handleUnbindClick(0, entry)
    await vi.waitFor(() => expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' })
    ))
    expect(bindings.isSaving.value).toBe(false)
    bindings.handleUnbindClick(0, entry)
    await vi.waitFor(() => expect(bindings.isSaving.value).toBe(false))
    expect(invoke).toHaveBeenCalledTimes(2)
  })
})
