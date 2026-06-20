import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { parse, compileScript } from 'vue/compiler-sfc'
import ts from 'typescript'
import { ref } from 'vue'

// `handleImageAction` lives as a <script setup> closure in sourceCode.vue
// (registered on the `image-action` bus during onMounted). The desktop unit
// runner ships no @vitejs/plugin-vue and no @vue/test-utils, so the SFC cannot
// be imported or mounted directly. Instead, compile the *real* source at
// runtime, swap its imports for injected stubs, and run setup() to grab the
// closure off the dev-mode `__returned__` bindings. This drives the actual
// product algorithm and re-reads the file every run, so it cannot drift.

const here = dirname(fileURLToPath(import.meta.url))
const vuePath = resolve(here, '../../../src/renderer/src/components/editorWithTabs/sourceCode.vue')

interface CMCursor {
  line: number
  ch: number
}

interface SetupBindings {
  editor: { value: unknown }
  handleImageAction: (payload: unknown) => void
}

interface SetupModule {
  default: { setup: (props: unknown, ctx: { expose: () => void }) => SetupBindings }
}

const loadComponent = (deps: Record<string, unknown>) => {
  const src = readFileSync(vuePath, 'utf8')
  const { descriptor } = parse(src)
  const compiled = compileScript(descriptor, { id: 'test' })
  // Drop every import; bindings come from the injected `__deps` object so the
  // store/codeMirror/muya/config modules never load.
  const noImports = compiled.content
    .split('\n')
    .filter((l) => !/^\s*import\s/.test(l))
    .join('\n')
  // esbuild's transformSync trips over jsdom's TextEncoder realm, so transpile
  // the TS away with the (pure-JS) typescript compiler.
  const js = ts.transpileModule(noImports, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText
  // Running the compiled setup needs the Function constructor; there is no
  // module loader to hand it the swapped-in dependency object otherwise.
  // eslint-disable-next-line no-new-func
  const factory = new Function(
    '__deps',
    'exports',
    'module',
    `const { _defineComponent, ref, watch, onMounted, onBeforeUnmount, nextTick,
      useEditorStore, usePreferencesStore, storeToRefs, codeMirror,
      setCursorAtFirstLine, setTextDirection, getWordCount, adjustCursor, bus,
      oneDarkThemes, railscastsThemes } = __deps
    ${js}
    return module.exports`
  ) as (deps: Record<string, unknown>, exports: object, module: object) => SetupModule
  const m = { exports: {} as Record<string, unknown> }
  const exported = factory(deps, m.exports, m)
  return exported.default
}

const makeDeps = (over: Record<string, unknown> = {}) => ({
  _defineComponent: (o: unknown) => o,
  ref,
  watch: () => {},
  onMounted: () => {},
  onBeforeUnmount: () => {},
  nextTick: () => Promise.resolve(),
  useEditorStore: () => ({ LISTEN_FOR_CONTENT_CHANGE: () => {} }),
  usePreferencesStore: () => ({}),
  storeToRefs: () => ({ theme: ref(''), sourceCode: ref(true), currentFile: ref(null) }),
  codeMirror: () => ({}),
  setCursorAtFirstLine: vi.fn(),
  setTextDirection: () => {},
  getWordCount: () => 0,
  adjustCursor: (c: unknown) => c,
  bus: { on: () => {}, off: () => {}, emit: () => {} },
  oneDarkThemes: [],
  railscastsThemes: [],
  ...over
})

interface StubCM {
  getValue: () => string
  setValue: (v: string) => void
  getCursor: (which: string) => CMCursor | null
  setSelection: ReturnType<typeof vi.fn>
}

const makeCM = (value: string, focus: CMCursor | null, anchor: CMCursor | null): StubCM => {
  let current = value
  return {
    getValue: () => current,
    setValue: (v: string) => {
      current = v
    },
    getCursor: (which: string) => (which === 'focus' ? focus : anchor),
    setSelection: vi.fn()
  }
}

const bootHandler = (cm: StubCM, deps: Record<string, unknown> = makeDeps()) => {
  const comp = loadComponent(deps)
  const ret = comp.setup(
    { markdown: '', muyaIndexCursor: null, textDirection: 'ltr' },
    { expose: () => {} }
  )
  ret.editor.value = cm
  return ret.handleImageAction
}

describe('sourceCode handleImageAction', () => {
  it('rewrites ![id](old) to ![alt](result) on the matched line', () => {
    const cm = makeCM('![abc123](old.png) tail', { line: 0, ch: 0 }, { line: 0, ch: 0 })
    bootHandler(cm)({ id: 'abc123', result: 'new.png', alt: 'cat' })
    expect(cm.getValue()).toBe('![cat](new.png) tail')
  })

  it('rewrites only the line carrying the id, leaving siblings intact', () => {
    const cm = makeCM(
      'before\n![abc123](old.png)\nafter',
      { line: 0, ch: 0 },
      { line: 0, ch: 0 }
    )
    bootHandler(cm)({ id: 'abc123', result: 'new.png', alt: 'cat' })
    expect(cm.getValue()).toBe('before\n![cat](new.png)\nafter')
  })

  it('shifts a cursor sitting after the image by the length delta', () => {
    // ![abc123](old.png) is 18 chars; ![cat](new.png) is 15 -> delta -3.
    const focus = { line: 0, ch: 20 }
    const anchor = { line: 0, ch: 20 }
    const cm = makeCM('![abc123](old.png) tail', focus, anchor)
    bootHandler(cm)({ id: 'abc123', result: 'new.png', alt: 'cat' })
    expect(focus.ch).toBe(17)
    expect(anchor.ch).toBe(17)
    expect(cm.setSelection).toHaveBeenCalledWith(anchor, focus, { scroll: true })
  })

  it('clamps a cursor inside the old image to the end of the new image text', () => {
    // New image text length = alt(3) + result(7) + 5 = 15.
    const focus = { line: 0, ch: 5 }
    const anchor = { line: 0, ch: 5 }
    const cm = makeCM('![abc123](old.png)', focus, anchor)
    bootHandler(cm)({ id: 'abc123', result: 'new.png', alt: 'cat' })
    expect(focus.ch).toBe(15)
    expect(anchor.ch).toBe(15)
  })

  it('leaves a cursor at or before the image start untouched', () => {
    const focus = { line: 0, ch: 0 }
    const anchor = { line: 0, ch: 0 }
    const cm = makeCM('![abc123](old.png) tail', focus, anchor)
    bootHandler(cm)({ id: 'abc123', result: 'new.png', alt: 'cat' })
    expect(focus.ch).toBe(0)
    expect(anchor.ch).toBe(0)
  })

  it('only adjusts pointers that sit on the rewritten line', () => {
    const focus = { line: 1, ch: 4 }
    const anchor = { line: 1, ch: 4 }
    const cm = makeCM('![abc123](old.png)\nplain text line', focus, anchor)
    bootHandler(cm)({ id: 'abc123', result: 'new.png', alt: 'cat' })
    // Image is on line 0; line-1 pointers are off the edited line, so untouched.
    expect(focus.ch).toBe(4)
    expect(anchor.ch).toBe(4)
  })

  it('does nothing when the id is absent from every line', () => {
    const deps = makeDeps()
    const cm = makeCM('no images here', { line: 0, ch: 3 }, { line: 0, ch: 3 })
    bootHandler(cm, deps)({ id: 'zzz', result: 'r.png', alt: 'x' })
    expect(cm.getValue()).toBe('no images here')
    expect(cm.setSelection).not.toHaveBeenCalled()
    expect((deps.setCursorAtFirstLine as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })

  it('early-returns on the structure-deleted branch (id present, no image markup)', () => {
    // The id still appears (indexOf > 0) but the ![..](..) was deleted, so the
    // broad image regex finds no match -> early return, no selection change.
    const deps = makeDeps()
    const cm = makeCM('see abc123 ref', { line: 0, ch: 10 }, { line: 0, ch: 10 })
    bootHandler(cm, deps)({ id: 'abc123', result: 'r.png', alt: 'x' })
    expect(cm.getValue()).toBe('see abc123 ref')
    expect(cm.setSelection).not.toHaveBeenCalled()
    expect((deps.setCursorAtFirstLine as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })

  it('skips an image whose id starts at column 0 (indexOf > 0 quirk)', () => {
    // findIndex uses `line.indexOf(id) > 0` (strict), so a line that begins
    // with the id renders no rewrite. Pinning the off-by-one rather than fixing.
    const cm = makeCM('abc123](old.png)', { line: 0, ch: 0 }, { line: 0, ch: 0 })
    bootHandler(cm)({ id: 'abc123', result: 'new.png', alt: 'cat' })
    expect(cm.getValue()).toBe('abc123](old.png)')
  })

  it('falls back to setCursorAtFirstLine when a pointer is null after a rewrite', () => {
    const deps = makeDeps()
    const cm = makeCM('![abc123](old.png)', { line: 0, ch: 5 }, null)
    bootHandler(cm, deps)({ id: 'abc123', result: 'new.png', alt: 'cat' })
    expect(cm.getValue()).toBe('![cat](new.png)')
    expect(cm.setSelection).not.toHaveBeenCalled()
    expect((deps.setCursorAtFirstLine as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1)
  })
})
