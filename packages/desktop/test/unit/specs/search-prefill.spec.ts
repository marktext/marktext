import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { parse, compileScript } from 'vue/compiler-sfc'
import ts from 'typescript'
import { ref, computed, watch, nextTick } from 'vue'

// Regression guard for the find-bar prefill race (issue: the input showed a
// stale single char like "T" instead of the selection). The bug lives entirely
// in search/index.vue's reactive logic: `watch(searchMatches)` mirrors the
// editor selection into the input, but when the find bar opens it steals focus
// and the engine emits a spurious selection-change pointing at the document
// start, which clobbers the just-prefilled value.
//
// The desktop unit runner ships no @vitejs/plugin-vue / @vue/test-utils, so we
// compile the real <script setup> at runtime, swap its imports for injected
// stubs (but keep Vue's *real* ref/computed/watch/nextTick), run setup() to grab
// the live bindings, and drive the actual reactive code. This mirrors the
// approach in source-code-image-action.spec.ts.

const here = dirname(fileURLToPath(import.meta.url))
const vuePath = resolve(here, '../../../src/renderer/src/components/search/index.vue')

interface Bindings {
  searchValue: { value: string }
  showSearch: { value: boolean }
  listenFind: () => void
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
  // eslint-disable-next-line no-new-func
  const factory = new Function(
    '__deps',
    'exports',
    'module',
    `const { _defineComponent, ref, computed, watch, onMounted, onBeforeUnmount,
      nextTick, bus, FindCaseIcon, FindWordIcon, FindRegexIcon, useEditorStore,
      storeToRefs, useI18n, debounce, ArrowDown, ArrowUp, RefreshRight, Switch } = __deps
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
  const currentFile = ref<{ searchMatches: { matches: unknown[]; index: number; value: string } } | null>({
    searchMatches: { matches: [], index: -1, value: '' }
  })
  const deps = {
    _defineComponent: (o: unknown) => o,
    ref,
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
    RefreshRight: {},
    Switch: {},
    useEditorStore: () => new Proxy({}, { get: () => () => {} }),
    storeToRefs: () => ({ currentFile }),
    useI18n: () => ({ t: (k: string) => k }),
    debounce: (fn: (...a: unknown[]) => unknown) => fn
  }
  const comp = loadComponent(deps)
  const ret = comp.setup({}, { expose: () => {} })
  const setSelection = (value: string) => {
    currentFile.value = { searchMatches: { matches: [], index: -1, value } }
  }
  return { ret, setSelection }
}

describe('find-bar prefill from selection', () => {
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
    // User selects a word in the editor.
    setSelection('fox')
    await nextTick()
    // Find bar opens (prefills "fox") and steals focus.
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
