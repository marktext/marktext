import { describe, it, expect, vi } from 'vitest'

// `@/store/editor` transitively imports `@/config`, which reads
// `window.path.sep` at module load (normally injected by the preload bridge).
// Stub it before the hoisted imports run so the store graph can load.
vi.hoisted(() => {
  const w = globalThis as unknown as { window?: { path?: { sep: string } } }
  w.window ??= {}
  w.window.path ??= { sep: '/' }
})

import { createSelectionFormatState } from '@/store/editor'
import { updateFormatMenu } from 'main_renderer/menu/actions/format'

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

    updateFormatMenu(menu, state)

    expect(checkedIds(menu).sort()).toEqual(
      ['highlightMenuItem', 'subscriptMenuItem', 'superscriptMenuItem', 'underlineMenuItem'].sort()
    )
  })

  it('still checks the existing inline formats (strong/em/...)', () => {
    const menu = makeMenu(FORMAT_MENU_IDS)
    const state = createSelectionFormatState([{ type: 'strong' }, { type: 'em' }])

    updateFormatMenu(menu, state)

    expect(checkedIds(menu).sort()).toEqual(['emphasisMenuItem', 'strongMenuItem'].sort())
  })

  it('clears checks when the selection carries no formats', () => {
    const menu = makeMenu(FORMAT_MENU_IDS)
    menu.items.forEach((i) => (i.checked = true))

    updateFormatMenu(menu, createSelectionFormatState([]))

    expect(checkedIds(menu)).toEqual([])
  })
})
