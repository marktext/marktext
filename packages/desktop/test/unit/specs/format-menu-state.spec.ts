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
// @ts-expect-error deep @muyajs/core subpath resolves at runtime (vite) but exposes no types
import inlineFormatIcons from '@muyajs/core/ui/inlineFormatToolbar/config'
import keybindingsWindows from 'main_renderer/keyboard/keybindingsWindows'
import keybindingsLinux from 'main_renderer/keyboard/keybindingsLinux'
import keybindingsDarwin from 'main_renderer/keyboard/keybindingsDarwin'
import { isEqualAccelerator } from 'common/keybinding'
import paragraphTemplate from 'main_renderer/menu/templates/paragraph'
import editTemplate from 'main_renderer/menu/templates/edit'
import viewTemplate from 'main_renderer/menu/templates/view'

interface IInlineFormatIcon { type: string, shortcut?: string }

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

// Two surfaces advertise inline-format shortcuts to the user:
//  - the desktop Format menu accelerators (keybindings*.ts → menu/templates/format.ts)
//  - the muya InlineFormatToolbar (`@muyajs/core` config.ts → tooltip badge)
// They are NOT derived from a single source, so they can drift. The test env is
// non-osx (jsdom userAgent has no "Mac"), so the toolbar config renders with the
// `Ctrl` COMMAND_KEY — line it up against the non-osx (Windows/Linux) keybindings.
describe('Format-menu accelerators vs muya inlineFormatToolbar shortcuts', () => {
  // muya toolbar `type` → desktop keybinding id (menu item accelerator source).
  const TYPE_TO_KEYBINDING: Readonly<Record<string, string>> = {
    strong: 'format.strong',
    em: 'format.emphasis',
    u: 'format.underline',
    del: 'format.strike',
    mark: 'format.highlight',
    inline_code: 'format.inline-code',
    inline_math: 'format.inline-math',
    link: 'format.hyperlink',
    image: 'format.image',
    clear: 'format.clear-format'
  }

  // Canonical form so display notation (`⇧+Ctrl+H`, `⌘`) and Electron accelerator
  // notation (`Ctrl+Shift+H`, `Command`) compare equal: sorted modifier set + key.
  const normalizeShortcut = (raw: string | undefined | null): string => {
    if (!raw) return ''
    const mods = new Set<string>()
    let key = ''
    for (const part of raw.split('+').map((p) => p.trim()).filter(Boolean)) {
      const lower = part.toLowerCase()
      if (lower === 'ctrl' || lower === 'control' || lower === '⌃') mods.add('ctrl')
      else if (lower === 'cmd' || lower === 'command' || lower === '⌘') mods.add('cmd')
      else if (lower === 'cmdorctrl' || lower === 'commandorcontrol') mods.add('cmdorctrl')
      else if (lower === 'shift' || lower === '⇧') mods.add('shift')
      else if (lower === 'alt' || lower === 'option' || lower === '⌥') mods.add('alt')
      else key = lower
    }
    return [...[...mods].sort(), `KEY=${key}`].join('+')
  }

  const toolbarShortcutOf = (type: string): string | undefined =>
    (inlineFormatIcons as IInlineFormatIcon[]).find((i) => i.type === type)?.shortcut

  it('confirms the test env is the non-osx (Ctrl) variant', () => {
    // The toolbar config picks COMMAND_KEY from `isOsx`; jsdom is non-osx here.
    expect(toolbarShortcutOf('strong')).toBe('Ctrl+B')
  })

  // strong/em are the requested reconcilable mapping, plus the rest of the set
  // that agrees once notation is normalized.
  const RECONCILABLE = ['strong', 'em', 'u', 'del', 'mark', 'inline_math', 'link', 'image', 'clear'] as const

  it.each(RECONCILABLE)(
    'toolbar shortcut for "%s" matches the Format-menu accelerator (Windows + Linux)',
    (type) => {
      const kbId = TYPE_TO_KEYBINDING[type]
      const toolbar = normalizeShortcut(toolbarShortcutOf(type))
      expect(toolbar).not.toBe('')
      expect(normalizeShortcut(keybindingsWindows.get(kbId))).toBe(toolbar)
      expect(normalizeShortcut(keybindingsLinux.get(kbId))).toBe(toolbar)
    }
  )

  // After #4611 the toolbar advertises the real defaults — Ctrl+` for inline code
  // and ⇧+Ctrl+M for inline math — so the tooltips agree with the keybindings.
  // inline_math now matches the Format menu on every platform (covered by
  // RECONCILABLE above). inline_code matches on Windows (Ctrl+`) but still
  // diverges on Linux, which intentionally binds Ctrl+Y (see #4611 / #3630).
  it('inlineCode toolbar matches Windows but diverges from the Linux accelerator (Ctrl+Y)', () => {
    const toolbar = normalizeShortcut(toolbarShortcutOf('inline_code'))
    expect(toolbar).toBe(normalizeShortcut('Ctrl+`'))
    // Windows binds Ctrl+` too, so toolbar and menu now agree there.
    expect(normalizeShortcut(keybindingsWindows.get('format.inline-code'))).toBe(toolbar)
    // Linux intentionally binds Ctrl+Y, which still diverges from the toolbar.
    expect(normalizeShortcut(keybindingsLinux.get('format.inline-code'))).toBe(
      normalizeShortcut('Ctrl+Y')
    )
    expect(normalizeShortcut(keybindingsLinux.get('format.inline-code'))).not.toBe(toolbar)
  })
})

// The Format slice above pins one menu's accelerators. The Paragraph/Edit/View
// templates source their accelerators the same way — `keybindings.getAccelerator(id)`
// off the active platform map — so a hardcoded literal in a template would silently
// diverge from the table. This walks each template with a fake keybindings backed by
// every platform map and asserts the menu items pass the table value through verbatim.
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

  // Walk the submenu tree, collecting every defined `accelerator` in source order.
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

  // The ids the template actually referenced, in the order items appear.
  const referencedIds = (template: Template): string[] =>
    collectAccelerators(template(makeIdProbe()))
      .filter((a): a is string => typeof a === 'string' && a.startsWith(SENTINEL))
      .map((a) => a.slice(SENTINEL.length))

  const PLATFORMS: ReadonlyArray<readonly [string, Map<string, string>]> = [
    ['Windows', keybindingsWindows],
    ['Linux', keybindingsLinux],
    ['Darwin', keybindingsDarwin]
  ]

  const TEMPLATES: ReadonlyArray<readonly [string, Template]> = [
    ['paragraph', paragraphTemplate as unknown as Template],
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
            // Non-empty binding: the item must carry exactly that accelerator.
            expect(typeof value).toBe('string')
            expect(isEqualAccelerator(value as string, expected)).toBe(true)
          } else {
            // Empty binding collapses to `accelerator: undefined`.
            expect(value).toBeUndefined()
          }
        })
      })
    }
  }

  // Spot-check the specific ids the checklist calls out, against the real table
  // values, so a wholesale table edit is caught even if the pass-through holds.
  it('binds the checklist-named ids to their documented platform accelerators', () => {
    expect(referencedIds(paragraphTemplate as unknown as Template)).toContain('paragraph.heading-1')
    expect(referencedIds(paragraphTemplate as unknown as Template)).toContain('paragraph.front-matter')
    expect(referencedIds(editTemplate as unknown as Template)).toContain('edit.duplicate')
    expect(referencedIds(editTemplate as unknown as Template)).toContain('edit.find-next')
    expect(referencedIds(editTemplate as unknown as Template)).toContain('edit.find-previous')
    expect(referencedIds(viewTemplate as unknown as Template)).toContain('view.source-code-mode')
    expect(referencedIds(viewTemplate as unknown as Template)).toContain('view.typewriter-mode')
    expect(referencedIds(viewTemplate as unknown as Template)).toContain('view.focus-mode')

    expect(isEqualAccelerator(accel(keybindingsDarwin, 'paragraph.heading-1'), 'Command+1')).toBe(true)
    expect(keybindingsWindows.get('paragraph.heading-1')).toBe('')
    expect(isEqualAccelerator(accel(keybindingsDarwin, 'edit.duplicate'), 'Command+Option+D')).toBe(true)
    expect(isEqualAccelerator(accel(keybindingsLinux, 'edit.duplicate'), 'Ctrl+Shift+E')).toBe(true)
    expect(isEqualAccelerator(accel(keybindingsLinux, 'edit.find-next'), 'F3')).toBe(true)
    expect(isEqualAccelerator(accel(keybindingsDarwin, 'edit.find-next'), 'Cmd+G')).toBe(true)
    expect(isEqualAccelerator(accel(keybindingsWindows, 'view.source-code-mode'), 'Ctrl+E')).toBe(true)
    expect(isEqualAccelerator(accel(keybindingsDarwin, 'view.source-code-mode'), 'Command+Option+S')).toBe(true)
    expect(isEqualAccelerator(accel(keybindingsWindows, 'view.focus-mode'), 'Ctrl+Shift+J')).toBe(true)
  })
})
