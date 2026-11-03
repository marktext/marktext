import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { parse, compileScript } from 'vue/compiler-sfc'
import ts from 'typescript'
import { ref, computed, watch, nextTick } from 'vue'
import escapeRegExp from 'lodash/escapeRegExp'

// Moving focus to Find previously let a native selection event overwrite the
// prefilled query. Exercise the component's setup with real Vue reactivity.

const here = dirname(fileURLToPath(import.meta.url))
const vuePath = resolve(here, '../../../src/renderer/src/components/search/index.vue')

interface Bindings {
  searchValue: { value: string }
  showSearch: { value: boolean }
  listenFind: () => void
  listenReplace: () => void
  hideSearch: () => void
  handleSearchKey: (event: KeyboardEvent) => void
  replaceValue: { value: string }
  searchFn: (selectHighlight?: boolean) => void
}

const loadComponent = (deps: Record<string, unknown>) => {
  const src = readFileSync(vuePath, 'utf8')
  const { descriptor } = parse(src)
  const compiled = compileScript(descriptor, { id: 'test' })
  const noImports = compiled.content
    .split('\n')
    .filter((l) => !/^\s*import\s/.test(l))
    .join('\n')
  const js = ts.transpileModule(noImports, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText
  const factory = new Function(
    '__deps',
    'exports',
    'module',
    `const { _defineComponent, ref, computed, watch, onMounted, onBeforeUnmount,
      nextTick, bus, FindCaseIcon, FindWordIcon, FindRegexIcon, useEditorStore,
      storeToRefs, useI18n, debounce, escapeRegExp, ArrowDown, ArrowUp, Close, RefreshRight, Switch, IconTooltip } = __deps
    ${js}
    return module.exports`
  ) as (deps: Record<string, unknown>, exports: object, module: object) => {
    default: { setup: (props: unknown, ctx: { expose: () => void }) => Bindings }
  }
  const m = { exports: {} as Record<string, unknown> }
  return factory(deps, m.exports, m).default
}

const makeBindings = () => {
  // currentFile.searchMatches is the channel SELECTION_CHANGE writes the
  // selected text into; storeToRefs hands the component a ref to it.
  const currentFile = ref<{ searchMatches: { matches: unknown[]; index: number; value: string; selectedText?: string } } | null>({
    searchMatches: { matches: [], index: -1, value: '' }
  })
  const deps = {
    _defineComponent: (o: unknown) => o,
    ref,
    escapeRegExp,
    computed,
    watch,
    nextTick,
    onMounted: () => {},
    onBeforeUnmount: () => {},
    bus: { on: () => {}, off: () => {}, emit: vi.fn() },
    FindCaseIcon: {},
    FindWordIcon: {},
    FindRegexIcon: {},
    ArrowDown: {},
    ArrowUp: {},
    Close: {},
    RefreshRight: {},
    Switch: {},
    IconTooltip: {},
    useEditorStore: () => new Proxy({}, { get: () => () => {} }),
    storeToRefs: () => ({ currentFile }),
    useI18n: () => ({ t: (k: string) => k }),
    debounce: (fn: (...a: unknown[]) => unknown) => Object.assign(fn, { cancel: vi.fn(), flush: vi.fn() })
  }
  const comp = loadComponent(deps)
  const ret = comp.setup({}, { expose: () => {} })
  const setSelection = (value: string) => {
    currentFile.value = { searchMatches: { matches: [], index: -1, value: '', selectedText: value } }
  }
  return { ret, setSelection, currentFile, bus: deps.bus }
}

describe('find-bar prefill from selection', () => {
  it.each(['', '此前的查询'])('keeps query %j when no text is selected', (query) => {
    const { ret, setSelection } = makeBindings()
    ret.searchValue.value = query
    setSelection('')
    ret.listenFind()
    expect(ret.searchValue.value).toBe(query)
  })

  it('prefills the input with the selected text when the bar opens', async() => {
    const { ret, setSelection } = makeBindings()
    setSelection('fox')
    await nextTick()
    ret.listenFind()
    await nextTick()
    expect(ret.searchValue.value).toBe('fox')
  })

  it('does not let the focus-steal selection-change clobber the prefill', async() => {
    const { ret, setSelection } = makeBindings()
    setSelection('fox')
    await nextTick()
    ret.listenFind()
    await nextTick()
    expect(ret.searchValue.value).toBe('fox')
    // Opening the bar steals editor focus → the engine emits a spurious
    // selection-change pointing at the document start ("T"). It must NOT
    // overwrite the prefilled query now that the bar owns it.
    setSelection('T')
    await nextTick()
    expect(ret.showSearch.value).toBe(true)
    expect(ret.searchValue.value).toBe('fox')
  })
})


describe('find-bar session', () => {
  it('seeds explicit Find from the selected match like VS Code', () => {
    const { ret, currentFile } = makeBindings()
    ret.searchValue.value = 'cat([0-9]+)'
    currentFile.value = {
      searchMatches: {
        value: 'cat([0-9]+)', index: 0,
        matches: [{ match: 'cat1' }], selectedText: 'cat1'
      }
    }
    ret.listenFind()
    expect(ret.searchValue.value).toBe('cat1')
  })

  it('prefills an open bar without scheduling a cursor-moving search', async() => {
    const { ret, setSelection, bus } = makeBindings()
    ret.listenFind()
    await nextTick()
    setSelection('banana')
    bus.emit.mockClear()
    ret.listenFind()
    expect(bus.emit).toHaveBeenCalledWith('searchValue', {
      value: 'banana',
      opt: expect.objectContaining({ selectHighlight: false })
    })
    expect(bus.emit).not.toHaveBeenCalledWith('searchValue', {
      value: 'banana',
      opt: expect.objectContaining({ selectHighlight: true })
    })
  })

  it('keeps the query when the editor selection changes while hidden', async() => {
    const { ret, setSelection } = makeBindings()
    ret.searchValue.value = 'apple'
    setSelection('banana')
    await nextTick()
    expect(ret.searchValue.value).toBe('apple')
    ret.listenFind()
    expect(ret.searchValue.value).toBe('banana')
  })

  it('hides without clearing either input and opens without moving the editor cursor', async() => {
    const { ret, bus } = makeBindings()
    ret.searchValue.value = 'apple'
    ret.replaceValue.value = 'pear'
    ret.listenFind()
    await nextTick()
    bus.emit.mockClear()
    ret.hideSearch()
    expect(ret.showSearch.value).toBe(false)
    expect(ret.searchValue.value).toBe('apple')
    expect(ret.replaceValue.value).toBe('pear')
    expect(bus.emit).toHaveBeenCalledWith('search-visibility', false)
    expect(bus.emit).not.toHaveBeenCalledWith('searchValue', expect.objectContaining({ value: '' }))
    ret.listenFind()
    expect(bus.emit).toHaveBeenCalledWith('searchValue', {
      value: 'apple',
      opt: expect.objectContaining({ selectHighlight: false })
    })
  })

  it('does not navigate or seed a query on Enter while the input is empty', () => {
    const { ret, bus, setSelection } = makeBindings()
    setSelection('原来的选区')
    ret.handleSearchKey(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(ret.searchValue.value).toBe('')
    expect(bus.emit).not.toHaveBeenCalledWith('find-action', expect.anything())
  })

  it('uses Shift+Enter for the previous result and ignores IME confirmation', () => {
    const { ret, bus } = makeBindings()
    ret.searchValue.value = 'apple'
    ret.handleSearchKey(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }))
    expect(bus.emit).toHaveBeenLastCalledWith('find-action', 'previous')
    ret.handleSearchKey(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(bus.emit).toHaveBeenLastCalledWith('find-action', 'next')
    bus.emit.mockClear()
    ret.handleSearchKey(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true }))
    expect(bus.emit).not.toHaveBeenCalled()
  })
})
