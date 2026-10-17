import type { Menu, MenuItemConstructorOptions } from 'electron'
import type Preference from 'main_renderer/preferences'
import type Keybindings from 'main_renderer/keyboard/shortcutHandler'
import { describe, expect, it, vi } from 'vitest'
import paragraphTemplate from 'main_renderer/menu/templates/paragraph'
import { updateSelectionMenus } from 'main_renderer/menu/actions/paragraph'

vi.mock('main_renderer/i18n', () => ({ t: (key: string) => key }))

const outlineItem = (fancyLists: boolean) =>
  (
    paragraphTemplate(
      { getAccelerator: (id: string) => (id === 'paragraph.outline' ? 'Command+Option+K' : null) } as unknown as Keybindings,
      { getItem: (key: string) => (key === 'fancyLists' ? fancyLists : true) } as unknown as Preference
    ).submenu as MenuItemConstructorOptions[]
  ).find((item) => item.id === 'outlineMenuItem')

describe('Paragraph > Outline', () => {
  it('appears only while fancy lists are on', () => {
    expect(outlineItem(false)).toBeUndefined()
    expect(outlineItem(true)).toMatchObject({ label: 'menu.paragraph.outline', accelerator: 'Command+Option+K' })
  })

  it('asks the editor for an outline list', () => {
    const send = vi.fn()
    outlineItem(true)?.click?.(null as never, { webContents: { send } } as never, null as never)
    expect(send).toHaveBeenCalledWith('mt::editor-paragraph-action', { type: 'ol-outline' })
  })

  it('stays enabled across a multi-block selection, which it wraps into one outline', () => {
    const outline = { id: 'outlineMenuItem', enabled: true, checked: false }
    const heading = { id: 'heading1MenuItem', enabled: true, checked: false }
    const menu = {
      getMenuItemById: (id: string) =>
        ({
          paragraphMenuEntry: { submenu: { items: [outline, heading] } },
          formatMenuItem: { submenu: { items: [] } }
        })[id]
    } as unknown as Menu
    updateSelectionMenus(menu, { affiliation: {}, isMultiline: true })
    expect(outline.enabled).toBe(true)
    expect(heading.enabled).toBe(false)
  })
})
