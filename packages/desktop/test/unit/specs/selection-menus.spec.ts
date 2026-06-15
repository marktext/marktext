import { describe, it, expect } from 'vitest'

import { updateSelectionMenus } from 'main_renderer/menu/actions/paragraph'

// Real paragraph submenu ids (see src/main/menu/templates/paragraph.ts). The
// source reads the paragraph entry via getMenuItemById('paragraphMenuEntry').
const PARAGRAPH_MENU_IDS = [
  'heading1MenuItem',
  'heading2MenuItem',
  'heading3MenuItem',
  'heading4MenuItem',
  'heading5MenuItem',
  'heading6MenuItem',
  'upgradeHeadingMenuItem',
  'degradeHeadingMenuItem',
  'tableMenuItem',
  'codeFencesMenuItem',
  'quoteBlockMenuItem',
  'mathBlockMenuItem',
  'htmlBlockMenuItem',
  'orderListMenuItem',
  'bulletListMenuItem',
  'taskListMenuItem',
  'looseListItemMenuItem',
  'paragraphMenuItem',
  'horizontalLineMenuItem',
  'frontMatterMenuItem'
]

// Real format submenu ids (see src/main/menu/templates/format.ts).
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

// `updateSelectionMenus` enables/disables (and re-checks) menu items via a
// loosely-typed Electron application menu surface: `getMenuItemById(id)`
// returns an object whose `submenu.items` are menu items keyed by `id`.
const makeMenu = () => {
  const paragraphItems = PARAGRAPH_MENU_IDS.map((id) => ({ id, enabled: true, checked: false }))
  const formatItems = FORMAT_MENU_IDS.map((id) => ({ id, enabled: true, checked: false }))
  return {
    paragraphItems,
    formatItems,
    getMenuItemById: (id: string) => {
      if (id === 'paragraphMenuEntry') return { submenu: { items: paragraphItems } }
      if (id === 'formatMenuItem') return { submenu: { items: formatItems } }
      return undefined
    }
  }
}

type FakeMenu = ReturnType<typeof makeMenu>

const enabledIds = (items: FakeMenu['paragraphItems']) =>
  items.filter((i) => i.enabled).map((i) => i.id)

const disabledIds = (items: FakeMenu['paragraphItems']) =>
  items.filter((i) => !i.enabled).map((i) => i.id)

// The set the source disables for multiline selections (DISABLE_LABELS).
const DISABLE_LABELS = [
  'heading1MenuItem',
  'heading2MenuItem',
  'heading3MenuItem',
  'heading4MenuItem',
  'heading5MenuItem',
  'heading6MenuItem',
  'upgradeHeadingMenuItem',
  'degradeHeadingMenuItem',
  'tableMenuItem',
  'hyperlinkMenuItem',
  'imageMenuItem'
]

describe('updateSelectionMenus', () => {
  it('disables every Paragraph submenu item when the selection is disabled (table/multi-block)', () => {
    const menu = makeMenu()

    updateSelectionMenus(menu, { affiliation: {}, isDisabled: true })

    expect(enabledIds(menu.paragraphItems)).toEqual([])
    expect(menu.paragraphItems.every((i) => i.enabled === false)).toBe(true)
  })

  it('leaves the Format submenu fully enabled for a disabled selection (it is reset first)', () => {
    const menu = makeMenu()

    updateSelectionMenus(menu, { affiliation: {}, isDisabled: true })

    expect(menu.formatItems.every((i) => i.enabled === true)).toBe(true)
  })

  it('disables hyperlink/image (Format) and heading/table (Paragraph) for a multiline selection', () => {
    const menu = makeMenu()

    updateSelectionMenus(menu, { affiliation: {}, isMultiline: true })

    // Format menu: only the DISABLE_LABELS entries it owns are disabled.
    const formatItem = (id: string) => menu.formatItems.find((i) => i.id === id)!
    expect(formatItem('hyperlinkMenuItem').enabled).toBe(false)
    expect(formatItem('imageMenuItem').enabled).toBe(false)
    expect(formatItem('strongMenuItem').enabled).toBe(true)
    expect(formatItem('emphasisMenuItem').enabled).toBe(true)

    // Paragraph menu: the DISABLE_LABELS heading/table entries are disabled.
    const paraDisabled = disabledIds(menu.paragraphItems)
    const expectedParaDisabled = DISABLE_LABELS.filter((id) => PARAGRAPH_MENU_IDS.includes(id))
    // Plus the loose-list-item is disabled because affiliation has no ul/ol.
    expect(paraDisabled.sort()).toEqual(
      [...expectedParaDisabled, 'looseListItemMenuItem'].sort()
    )
  })

  it('disables every Format submenu item for code content and re-enables codeFences (Paragraph)', () => {
    const menu = makeMenu()

    updateSelectionMenus(menu, {
      affiliation: { code: true },
      isCodeFences: true,
      isCodeContent: true
    })

    // Every format item is disabled inside code content.
    expect(menu.formatItems.every((i) => i.enabled === false)).toBe(true)

    // Paragraph submenu is disabled wholesale by isCodeFences...
    const paraItem = (id: string) => menu.paragraphItems.find((i) => i.id === id)!
    expect(paraItem('paragraphMenuItem').enabled).toBe(false)
    expect(paraItem('heading1MenuItem').enabled).toBe(false)
    // ...except codeFencesMenuItem is re-enabled because affiliation has a code element.
    expect(paraItem('codeFencesMenuItem').enabled).toBe(true)
  })

  it('disables loose-list-item when the affiliation has neither ul nor ol', () => {
    const menu = makeMenu()

    updateSelectionMenus(menu, { affiliation: { p: true } })

    const loose = menu.paragraphItems.find((i) => i.id === 'looseListItemMenuItem')!
    expect(loose.enabled).toBe(false)
  })

  it('keeps loose-list-item enabled when the affiliation is a list (ul/ol)', () => {
    const menu = makeMenu()

    updateSelectionMenus(menu, { affiliation: { ul: true } })

    const loose = menu.paragraphItems.find((i) => i.id === 'looseListItemMenuItem')!
    expect(loose.enabled).toBe(true)
  })

  it('checks the matching paragraph item via the affiliation -> menu id map', () => {
    const menu = makeMenu()

    updateSelectionMenus(menu, { affiliation: { h1: true } })

    const checked = menu.paragraphItems.filter((i) => i.checked).map((i) => i.id)
    expect(checked).toEqual(['heading1MenuItem'])
  })
})
