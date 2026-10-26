import { describe, it, expect, vi } from 'vitest'
import { type Menu, type MenuItemConstructorOptions } from 'electron'

// `@/store/editor` transitively imports `@/config`, which reads
// `window.path.sep` at module load (normally injected by the preload bridge).
// Stub it before the hoisted imports run so the store graph can load.
vi.hoisted(() => {
  const w = globalThis as unknown as { window?: { path?: { sep: string } } }
  w.window ??= {}
  w.window.path ??= { sep: '/' }
})

// The menu templates pull in `../actions/*` (which register `ipcMain.on` at
// module load), `electron-log`, and the i18n loader (reads locale JSON off
// disk). None of that is exercised here — we only build the menu structure and
// read accelerators — so stub the heavy surfaces to keep the slice hermetic.
vi.mock('electron', () => ({
  ipcMain: { on: () => {}, emit: () => {}, handle: () => {} },
  BrowserWindow: { fromWebContents: () => undefined, getAllWindows: () => [] }
}))
vi.mock('electron-log', () => ({ default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))
vi.mock('main_renderer/i18n', () => ({ t: (key: string) => key }))

import { createSelectionFormatState } from '@/store/editor'
import { updateFormatMenu } from 'main_renderer/menu/actions/format'
import keybindingsWindows from 'main_renderer/keyboard/keybindingsWindows'
import keybindingsLinux from 'main_renderer/keyboard/keybindingsLinux'
import keybindingsDarwin from 'main_renderer/keyboard/keybindingsDarwin'
import { isEqualAccelerator } from 'common/keybinding'
import paragraphTemplate from 'main_renderer/menu/templates/paragraph'
import editTemplate from 'main_renderer/menu/templates/edit'
import viewTemplate from 'main_renderer/menu/templates/view'

// Mimic the Electron application menu surface `updateFormatMenu` touches:
// `getMenuItemById('formatMenuItem')` returning an object whose
// `submenu.items` are checkbox menu items keyed by `id`.
const makeMenu = (ids: string[]) => {
  const items = ids.map((id) => ({ id, checked: false }))
  return {
    getMenuItemById: (id: string) =>
      id === 'formatMenuItem' ? { submenu: { items } } : undefined,
    items
  }
}

const FORMAT_MENU_IDS = [
  'strongMenuItem',
  'emphasisMenuItem',
  'underlineMenuItem',
  'superscriptMenuItem',
  'subscriptMenuItem',
  'highlightMenuItem',
  'inlineCodeMenuItem',
  'inlineMathMenuItem',
  'strikeMenuItem',
  'hyperlinkMenuItem',
  'imageMenuItem'
]

const checkedIds = (menu: ReturnType<typeof makeMenu>) =>
  menu.items.filter((i) => i.checked).map((i) => i.id)

describe('createSelectionFormatState', () => {
  it('keys html_tag tokens by their tag (u/sup/sub/mark), not "html_tag"', () => {
    const state = createSelectionFormatState([
      { type: 'html_tag', tag: 'u' },
      { type: 'html_tag', tag: 'sup' },
      { type: 'html_tag', tag: 'sub' },
      { type: 'html_tag', tag: 'mark' },
      { type: 'strong' }
    ])

    expect(state).toEqual({ u: true, sup: true, sub: true, mark: true, strong: true })
    expect(state.html_tag).toBeUndefined()
  })
})

describe('updateFormatMenu', () => {
  it('checks underline/superscript/subscript/highlight when the caret is inside them', () => {
    const menu = makeMenu(FORMAT_MENU_IDS)
    const state = createSelectionFormatState([
      { type: 'html_tag', tag: 'u' },
      { type: 'html_tag', tag: 'sup' },
      { type: 'html_tag', tag: 'sub' },
      { type: 'html_tag', tag: 'mark' }
    ])

    updateFormatMenu(menu as unknown as Menu, state)

    expect(checkedIds(menu).sort()).toEqual(
      ['highlightMenuItem', 'subscriptMenuItem', 'superscriptMenuItem', 'underlineMenuItem'].sort()
    )
  })

  it('still checks the existing inline formats (strong/em/...)', () => {
    const menu = makeMenu(FORMAT_MENU_IDS)
    const state = createSelectionFormatState([{ type: 'strong' }, { type: 'em' }])

    updateFormatMenu(menu as unknown as Menu, state)

    expect(checkedIds(menu).sort()).toEqual(['emphasisMenuItem', 'strongMenuItem'].sort())
  })

  it('clears checks when the selection carries no formats', () => {
    const menu = makeMenu(FORMAT_MENU_IDS)
    menu.items.forEach((i) => (i.checked = true))

    updateFormatMenu(menu as unknown as Menu, createSelectionFormatState([]))

    expect(checkedIds(menu)).toEqual([])
  })
})

// Exercise templates against every platform map to catch hardcoded accelerators.
// Muya's host hint mapping is covered separately in muya-shortcuts.spec.ts.
describe('menu template accelerators match the platform keybinding tables (Paragraph/Edit/View)', () => {
  type Template = (kb: { getAccelerator(id: string): string | null }) => MenuItemConstructorOptions

  // Sentinel-id keybindings: records the id of every accelerator the template
  // pulls and returns the id itself so it can be recovered from the menu item.
  const SENTINEL = ''
  const makeIdProbe = () => ({
    getAccelerator: (id: string) => `${SENTINEL}${id}`
  })

  // Mirrors the real `getAccelerator`: empty bindings collapse to null (which the
  // templates turn into `accelerator: undefined`), non-empty bindings pass through.
  const makeMapKeybindings = (map: Map<string, string>) => ({
    getAccelerator: (id: string) => {
      const name = map.get(id)
      return name || null
    }
  })

  // Map lookups are guaranteed present by the "exists in every platform table"
  // tests, so resolve to '' rather than sprinkling non-null assertions.
  const accel = (map: Map<string, string>, id: string): string => map.get(id) ?? ''

  const collectAccelerators = (node: MenuItemConstructorOptions): (string | undefined)[] => {
    const out: (string | undefined)[] = []
    const submenu = node.submenu
    if (!Array.isArray(submenu)) return out
    for (const item of submenu) {
      if ('accelerator' in item) out.push(item.accelerator)
      if (item.submenu && Array.isArray(item.submenu)) {
        out.push(...collectAccelerators(item as MenuItemConstructorOptions))
      }
    }
    return out
  }

  const referencedIds = (template: Template): string[] =>
    collectAccelerators(template(makeIdProbe()))
      .filter((a): a is string => typeof a === 'string' && a.startsWith(SENTINEL))
      .map((a) => a.slice(SENTINEL.length))

  const PLATFORMS: ReadonlyArray<readonly [string, Map<string, string>]> = [
    ['Windows', keybindingsWindows],
    ['Linux', keybindingsLinux],
    ['Darwin', keybindingsDarwin]
  ]

  // The Paragraph template also reads preferences — Math Block is listed only
  // while `texMathDollars` is on (#5446). These accelerator checks want the
  // full item set, so hand it a preference that answers with the defaults.
  const defaultPreference = { getItem: () => undefined }
  const paragraphWithDefaults: Template = (kb) =>
    (paragraphTemplate as unknown as (
      kb: unknown,
      prefs: unknown
    ) => MenuItemConstructorOptions)(kb, defaultPreference)

  const TEMPLATES: ReadonlyArray<readonly [string, Template]> = [
    ['paragraph', paragraphWithDefaults],
    ['edit', editTemplate as unknown as Template],
    ['view', viewTemplate as unknown as Template]
  ]

  for (const [tName, template] of TEMPLATES) {
    it(`${tName} template only references ids that exist in every platform table`, () => {
      const ids = referencedIds(template)
      expect(ids.length).toBeGreaterThan(0)
      for (const id of ids) {
        for (const [pName, map] of PLATFORMS) {
          expect(`${pName}:${id}=${map.has(id)}`).toBe(`${pName}:${id}=true`)
        }
      }
    })

    for (const [pName, map] of PLATFORMS) {
      it(`${tName} template accelerators equal the ${pName} table values (no hardcoded literal)`, () => {
        const ids = referencedIds(template)
        // Build the same menu with real table values; items line up 1:1 with `ids`
        // because the source order is deterministic.
        const produced = collectAccelerators(template(makeMapKeybindings(map)))
        expect(produced.length).toBe(ids.length)

        produced.forEach((value, i) => {
          const id = ids[i]
          const expected = map.get(id) ?? ''
          if (expected) {
            expect(typeof value).toBe('string')
            expect(isEqualAccelerator(value as string, expected)).toBe(true)
          } else {
            expect(value).toBeUndefined()
          }
        })
      })
    }
  }

  // Spot-check the specific ids the checklist calls out, against the real table
  // values, so a wholesale table edit is caught even if the pass-through holds.
  it('binds the checklist-named ids to their documented platform accelerators', () => {
    expect(referencedIds(paragraphWithDefaults)).toContain('paragraph.heading-1')
    expect(referencedIds(paragraphWithDefaults)).toContain('paragraph.front-matter')
    expect(referencedIds(editTemplate as unknown as Template)).toContain('edit.duplicate')
    expect(referencedIds(editTemplate as unknown as Template)).toContain('edit.find-next')
    expect(referencedIds(editTemplate as unknown as Template)).toContain('edit.find-previous')
    expect(referencedIds(viewTemplate as unknown as Template)).toContain('view.source-code-mode')
    expect(referencedIds(viewTemplate as unknown as Template)).toContain('view.typewriter-mode')
    expect(referencedIds(viewTemplate as unknown as Template)).toContain('view.focus-mode')

    expect(isEqualAccelerator(accel(keybindingsDarwin, 'paragraph.heading-1'), 'Command+1')).toBe(true)
    expect(keybindingsWindows.get('paragraph.heading-1')).toBe('')
    expect(isEqualAccelerator(accel(keybindingsDarwin, 'edit.duplicate'), 'Shift+Command+E')).toBe(true)
    expect(isEqualAccelerator(accel(keybindingsLinux, 'edit.duplicate'), 'Ctrl+Shift+E')).toBe(true)
    expect(isEqualAccelerator(accel(keybindingsLinux, 'edit.find-next'), 'F3')).toBe(true)
    expect(isEqualAccelerator(accel(keybindingsDarwin, 'edit.find-next'), 'Cmd+G')).toBe(true)
    expect(isEqualAccelerator(accel(keybindingsWindows, 'view.source-code-mode'), 'Ctrl+E')).toBe(true)
    expect(isEqualAccelerator(accel(keybindingsDarwin, 'view.source-code-mode'), 'Command+Option+S')).toBe(true)
    expect(isEqualAccelerator(accel(keybindingsWindows, 'view.focus-mode'), 'Ctrl+Shift+J')).toBe(true)
  })
})
