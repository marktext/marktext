import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parse, compileScript } from 'vue/compiler-sfc'
import ts from 'typescript'
import { computed, ref } from 'vue'
import {
  PANDOC_DOCX_TEMPLATES,
  PANDOC_EXPORT_FORMATS,
  PANDOC_EXPORT_LOCATIONS,
  getPandocDefaultFormat,
  getPandocExportFormats
} from '@shared/pandoc'

// Regression guard for the export-format check list.
//
// The preferences page feeds the check list its options and its selected value.
// When both came from the same "formats the menu offers" helper, unticking a
// format removed it from the *options* as well, so the row vanished the instant
// it was unticked — and once every format was unticked the default-format
// select was left showing an empty "Select" box with nothing left to tick, a
// state the page could not get out of.
//
// The desktop unit runner ships no @vitejs/plugin-vue / @vue/test-utils, so the
// real <script setup> is compiled at runtime, its imports swapped for injected
// stubs (with Vue's actual ref/computed), and setup() run to drive the live
// reactive code. Same approach as search-prefill.spec.ts.

const here = path.dirname(fileURLToPath(import.meta.url))
const vuePath = path.join(here, '../../../src/renderer/src/prefComponents/pandoc/index.vue')
const vueSource = readFileSync(vuePath, { encoding: 'utf8' })

const templateSource = (): string => {
  const { descriptor } = parse(vueSource)
  if (!descriptor.template) {
    throw new Error('the pandoc preferences page has no <template>')
  }
  return descriptor.template.content
}

/**
 * The opening tag of the first `<tag ...>`, with quoted attribute values
 * skipped so a `>` inside one (as in `v-if="x.length > 0"`) does not truncate
 * the match.
 */
const openingTag = (tag: string): string => {
  const template = templateSource()
  const start = template.indexOf(`<${tag}`)
  if (start === -1) {
    throw new Error(`<${tag}> not found in the pandoc preferences page`)
  }
  let quote: string | undefined
  for (let i = start; i < template.length; i += 1) {
    const char = template[i]
    if (quote) {
      if (char === quote) {
        quote = undefined
      }
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
    } else if (char === '>') {
      return template.slice(start, i + 1)
    }
  }
  throw new Error(`<${tag}> has no closing bracket`)
}

/**
 * Drop every import so the identifiers come from the injected stubs instead.
 *
 * This page writes its imports across several lines, so a line-based filter
 * would leave dangling `from '...'` fragments behind.
 */
const stripImports = (code: string): string =>
  code
    .replace(/^[ \t]*import[\s\S]*?\bfrom[ \t]*['"][^'"]*['"][ \t]*;?[ \t]*$/gm, '')
    .replace(/^[ \t]*import[ \t]*['"][^'"]*['"][ \t]*;?[ \t]*$/gm, '')

interface FormatOption {
  label: string
  value: string
}

interface Bindings {
  allFormatOptions: FormatOption[]
  menuFormatOptions: { value: FormatOption[] }
  selectedDefaultFormat: { value: string }
  onFormatsChange: (value: string[]) => void
}

const loadPanel = (deps: Record<string, unknown>) => {
  const { descriptor } = parse(vueSource)
  const compiled = compileScript(descriptor, { id: 'test' })
  const js = ts.transpileModule(stripImports(compiled.content), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText
  // eslint-disable-next-line no-new-func
  const factory = new Function(
    '__deps',
    'exports',
    'module',
    `const { _defineComponent, ref, computed, onBeforeUnmount, useI18n, storeToRefs,
      usePreferencesStore, PANDOC_DOCX_TEMPLATES, PANDOC_EXPORT_FORMATS,
      PANDOC_EXPORT_LOCATIONS, getPandocDefaultFormat, getPandocExportFormats } = __deps
    ${js}
    return module.exports`
  ) as (deps: Record<string, unknown>, exports: object, module: object) => {
    default: { setup: (props: unknown, ctx: { expose: () => void }) => Bindings }
  }
  const m = { exports: {} as Record<string, unknown> }
  return factory(deps, m.exports, m).default
}

const ALL_IDS = PANDOC_EXPORT_FORMATS.map((format) => format.id)

/** A preferences store stub: `storeToRefs` hands the page live refs it writes through. */
const makePanel = (overrides: Record<string, unknown> = {}) => {
  const initial: Record<string, unknown> = {
    pandocDefaultFormat: 'docx',
    pandocExportFormats: [...ALL_IDS],
    pandocDocxTemplate: 'default',
    ...overrides
  }
  const refs: Record<string, { value: unknown }> = {}
  for (const [key, value] of Object.entries(initial)) {
    refs[key] = ref(value)
  }

  const store = {
    SET_SINGLE_PREFERENCE: ({ type, value }: { type: string; value: unknown }) => {
      refs[type].value = value
    }
  }

  const deps = {
    _defineComponent: (options: unknown) => options,
    ref,
    computed,
    onBeforeUnmount: (hook: () => void) => hook(),
    useI18n: () => ({ t: (key: string) => key }),
    storeToRefs: () => refs,
    usePreferencesStore: () => store,
    PANDOC_DOCX_TEMPLATES,
    PANDOC_EXPORT_FORMATS,
    PANDOC_EXPORT_LOCATIONS,
    getPandocDefaultFormat,
    getPandocExportFormats
  }

  return { ret: loadPanel(deps).setup({}, { expose: () => {} }), refs }
}

const valuesOf = (options: readonly FormatOption[]): string[] =>
  options.map((option) => option.value)

describe('pandoc export format check list', () => {
  it('lists every format up front', () => {
    const { ret } = makePanel()
    expect(valuesOf(ret.allFormatOptions)).toEqual(ALL_IDS)
    expect(valuesOf(ret.menuFormatOptions.value)).toEqual(ALL_IDS)
  })

  // The bug: options were derived from the selection, so an unticked format
  // disappeared instead of merely losing its tick.
  it('keeps an unticked format in the list so it can be ticked again', () => {
    const { ret } = makePanel()

    ret.onFormatsChange(['html', 'epub'])

    expect(valuesOf(ret.allFormatOptions)).toEqual(ALL_IDS)
    expect(valuesOf(ret.menuFormatOptions.value)).toEqual(['html', 'epub'])
  })

  it('leaves an empty selection recoverable', () => {
    const { ret } = makePanel()

    ret.onFormatsChange([])

    expect(ret.menuFormatOptions.value).toEqual([])
    expect(ret.selectedDefaultFormat.value).toBe('')
    // Nothing is offered, but the row is still there to be re-ticked.
    expect(valuesOf(ret.allFormatOptions)).toEqual(ALL_IDS)
  })

  it('offers only the ticked formats as the default', () => {
    const { ret } = makePanel({ pandocDefaultFormat: 'epub' })

    ret.onFormatsChange(['docx', 'html'])

    expect(valuesOf(ret.menuFormatOptions.value)).toEqual(['docx', 'html'])
  })

  // Otherwise the page shows one format while the menu marks another.
  it('moves the default off a format the user just unticked', () => {
    const { ret, refs } = makePanel({ pandocDefaultFormat: 'docx' })

    ret.onFormatsChange(['html', 'epub'])

    expect(refs.pandocDefaultFormat.value).toBe('html')
    expect(ret.selectedDefaultFormat.value).toBe('html')
  })

  it('leaves the default where it is while it is still ticked', () => {
    const { ret, refs } = makePanel({ pandocDefaultFormat: 'epub' })

    ret.onFormatsChange([...ALL_IDS])

    expect(refs.pandocDefaultFormat.value).toBe('epub')
    expect(ret.selectedDefaultFormat.value).toBe('epub')
  })

  // Unticking everything says "no export menu entry", not "forget my format".
  it('remembers the default across unticking everything', () => {
    const { ret, refs } = makePanel({ pandocDefaultFormat: 'docx' })

    ret.onFormatsChange([])
    expect(refs.pandocDefaultFormat.value).toBe('docx')
    expect(ret.selectedDefaultFormat.value).toBe('')

    ret.onFormatsChange(['docx'])
    expect(refs.pandocDefaultFormat.value).toBe('docx')
    expect(ret.selectedDefaultFormat.value).toBe('docx')
  })

  // A hand-edited or older preferences file can name a format that is no longer
  // ticked; the page must show what an export would really use.
  it('shows the effective default when the stored one is not ticked', () => {
    const { ret } = makePanel({ pandocDefaultFormat: 'pptx', pandocExportFormats: ['rtf'] })

    expect(ret.selectedDefaultFormat.value).toBe('rtf')
    expect(valuesOf(ret.menuFormatOptions.value)).toEqual(['rtf'])
  })
})

// The two lists only stay distinct if the template keeps them apart: handing the
// check list the filtered list brings the disappearing-row bug straight back.
describe('pandoc preferences template wiring', () => {
  it('feeds the check list every format', () => {
    const checkList = openingTag('check-list')
    expect(checkList).toContain(':options="allFormatOptions"')
    expect(checkList).toContain(':value="pandocExportFormats"')
  })

  it('feeds the default-format select only the ticked formats', () => {
    expect(openingTag('el-select')).toContain(':model-value="selectedDefaultFormat"')
    expect(openingTag('el-option')).toContain('v-for="option in menuFormatOptions"')
  })

  // With nothing ticked there is no default to choose, so the row goes away
  // instead of leaving a dead "Select" box behind.
  it('hides the default-format row when nothing is ticked', () => {
    const template = templateSource()
    const guardAt = template.indexOf('v-if="menuFormatOptions.length > 0"')
    const selectAt = template.indexOf('<el-select')

    expect(guardAt).toBeGreaterThan(-1)
    expect(guardAt).toBeLessThan(selectAt)
    // The guard sits on the row wrapper, not on some unrelated element.
    expect(template.slice(template.lastIndexOf('<', guardAt), guardAt).trim()).toBe('<div')
  })
})
