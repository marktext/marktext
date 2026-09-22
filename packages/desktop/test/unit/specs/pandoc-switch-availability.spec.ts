import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, compileScript } from 'vue/compiler-sfc'
import ts from 'typescript'
import { ref } from 'vue'

// The desktop unit runner ships no @vitejs/plugin-vue and no @vue/test-utils, so the
// pane cannot be imported or mounted. Compile the *real* source at run time instead,
// swap its imports for injected stubs and drive setup() — the availability rule below
// is the component's own computed, re-read from disk on every run.

const here = dirname(fileURLToPath(import.meta.url))
const pkg = resolve(here, '../../..')
const vuePath = join(pkg, 'src/renderer/src/prefComponents/general/index.vue')

// `ts.transpileModule` rewrites the ESM `export default` for us, so the factory needs
// `exports`/`module`. `Function` is the only way to hand the compiled body its deps.
/* eslint-disable no-new-func */
const loadComponent = (deps: Record<string, unknown>) => {
  const { descriptor } = parse(readFileSync(vuePath, 'utf8'))
  const compiled = compileScript(descriptor, { id: 'test' })
  // Whole statements: the config import spans several lines.
  const noImports = compiled.content.replace(/^import[\s\S]*?['"][^'"]*['"]\s*;?/gm, '')
  const js = ts.transpileModule(noImports, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText
  const names = [
    '_defineComponent',
    'ref',
    'computed',
    'onMounted',
    'storeToRefs',
    'usePreferencesStore',
    'useI18n',
    'Compound',
    'Range',
    'CurSelect',
    'Bool',
    'textBox',
    'isOsx',
    'getTitleBarStyleOptions',
    'zoomOptions',
    'getFileSortByOptions',
    'getFileSortOrderOptions',
    'getLanguageOptions'
  ]
  const factory = new Function(
    '__deps',
    'exports',
    'module',
    `const { ${names.join(', ')} } = __deps
    ${js}
    return module.exports`
  ) as (
    deps: Record<string, unknown>,
    exports: object,
    module: object
  ) => {
    default: SetupComponent
  }
  const m = { exports: {} as Record<string, unknown> }
  return factory(deps, m.exports, m).default
}
/* eslint-enable no-new-func */

interface SetupComponent {
  setup: (
    props: Record<string, unknown>,
    ctx: { expose: () => void }
  ) => { pandocStatus: { value: string }; pandocDisabled: { value: boolean } }
}

const messages = JSON.parse(readFileSync(join(pkg, 'static/locales/en.json'), 'utf8'))

// Narrow stand-in for vue-i18n: looks the key up and applies the {path} placeholder.
const translate = (key: string, named?: Record<string, string>) => {
  const value = key.split('.').reduce<unknown>((node, part) => {
    return typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : ''
  }, messages)
  if (typeof value !== 'string') throw new Error(`missing message: ${key}`)
  return Object.entries(named ?? {}).reduce((text, [k, v]) => text.replace(`{${k}}`, v), value)
}

const makeStore = (switchOn: boolean) => ({
  showPandocConvert: ref(switchOn),
  defaultDirectoryToOpen: ref(''),
  treePathExcludePatterns: ref([])
})

const bootPane = (payload: { command: string | null; onPath: boolean }, switchOn: boolean) => {
  const mounted: (() => Promise<void>)[] = []
  const store = makeStore(switchOn)
  ;(window as unknown as { electron: unknown }).electron = {
    ipcRenderer: { invoke: () => Promise.resolve(payload) }
  }
  const deps = {
    _defineComponent: (o: unknown) => o,
    ref,
    computed: (fn: () => unknown) => ({
      get value() {
        return fn()
      }
    }),
    onMounted: (cb: () => Promise<void>) => mounted.push(cb),
    usePreferencesStore: () => store,
    storeToRefs: (preferences: unknown) => preferences,
    useI18n: () => ({ t: translate }),
    isOsx: false
  }
  const pane = loadComponent(deps).setup({}, { expose: () => {} })
  return {
    pane,
    detect: () => Promise.all(mounted.map((cb) => cb())).then(() => undefined)
  }
}

const INSTALLED = { command: 'C:\\Program Files\\Pandoc\\pandoc.exe', onPath: false }

describe('Pandoc switch availability', () => {
  it('stays clickable only while pandoc is there', async() => {
    const { pane, detect } = bootPane(INSTALLED, false)
    await detect()

    expect(pane.pandocStatus.value).toBe('Found: C:\\Program Files\\Pandoc\\pandoc.exe')
    expect(pane.pandocDisabled.value).toBe(false)
  })

  it('greys out when pandoc is missing', async() => {
    const { pane, detect } = bootPane({ command: null, onPath: false }, false)
    await detect()

    expect(pane.pandocStatus.value).toBe('Not found')
    expect(pane.pandocDisabled.value).toBe(true)
  })

  it('leaves an enabled switch reachable, so the menu can still be turned off', async() => {
    const { pane, detect } = bootPane({ command: null, onPath: false }, true)
    await detect()

    expect(pane.pandocStatus.value).toBe('Not found')
    expect(pane.pandocDisabled.value).toBe(false)
  })

  it('does not flash grey before the answer arrives', () => {
    const { pane } = bootPane({ command: null, onPath: false }, false)

    expect(pane.pandocDisabled.value).toBe(false)
  })

  it('is wired to the switch row', () => {
    const src = readFileSync(vuePath, 'utf8')
    const row = src.slice(src.indexOf('preferences.general.pandoc.title'))
    const bool = row.slice(row.indexOf('<bool'), row.indexOf('/>') + 2)

    expect(bool).toContain(':disable="pandocDisabled"')
    expect(bool).toContain(':notes="pandocStatus"')
  })
})
