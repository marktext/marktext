import type { Menu, MenuItemConstructorOptions } from 'electron'
import type Preference from 'main_renderer/preferences'
import type Keybindings from 'main_renderer/keyboard/shortcutHandler'
import { describe, expect, it, vi } from 'vitest'
import paragraphTemplate from 'main_renderer/menu/templates/paragraph'
import { updateSelectionMenus } from 'main_renderer/menu/actions/paragraph'

vi.mock('main_renderer/i18n', () => ({ t: (key: string) => key }))

const types = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION']
const menuTemplate = (enabled: boolean) =>
  paragraphTemplate(
    { getAccelerator: vi.fn() } as unknown as Keybindings,
    { getItem: (key: string) => (key === 'githubAlerts' ? enabled : true) } as unknown as Preference
  ).submenu as MenuItemConstructorOptions[]

describe('GitHub Alerts application menus', () => {
  it('hides the submenu by default and exposes five types without shortcuts when enabled', () => {
    expect(menuTemplate(false).find((item) => item.id === 'githubAlertsMenuItem')).toBeUndefined()
    const group = menuTemplate(true).find((item) => item.id === 'githubAlertsMenuItem')!
    const children = group.submenu as MenuItemConstructorOptions[]
    expect(children.map((item) => item.label)).toEqual(types)
    expect(children.every((item) => !item.accelerator)).toBe(true)
  })

  it('dispatches the selected type through the existing typed paragraph channel', () => {
    const group = menuTemplate(true).find((item) => item.id === 'githubAlertsMenuItem')!
    const child = (group.submenu as MenuItemConstructorOptions[])[2]
    const send = vi.fn()
    child.click!(null as never, { webContents: { send } } as never, null as never)
    expect(send).toHaveBeenCalledWith('mt::editor-paragraph-action', {
      type: 'github-alert IMPORTANT'
    })
  })

  it('updates nested checked states and disables unavailable contexts', () => {
    const children = types.map((label) => ({ label, enabled: true, checked: false }))
    const alerts = {
      id: 'githubAlertsMenuItem',
      enabled: true,
      checked: false,
      submenu: { items: children }
    }
    const quote = { id: 'quoteBlockMenuItem', enabled: true, checked: false }
    const menu = {
      getMenuItemById: (id: string) =>
        ({
          paragraphMenuEntry: { submenu: { items: [alerts, quote] } },
          formatMenuItem: { submenu: { items: [] } },
          githubAlertsMenuItem: alerts,
          quoteBlockMenuItem: quote
        })[id]
    } as unknown as Menu
    updateSelectionMenus(menu, {
      affiliation: { blockquote: true },
      canGithubAlerts: true,
      alertType: 'TIP',
      isMultiline: true
    })
    expect(alerts.enabled).toBe(true)
    expect(children.filter((item) => item.checked).map((item) => item.label)).toEqual(['TIP'])
    expect(quote.checked).toBe(false)
    updateSelectionMenus(menu, { affiliation: {} })
    expect(alerts.enabled).toBe(false)
    expect(children.every((item) => !item.enabled && !item.checked)).toBe(true)
  })

})
