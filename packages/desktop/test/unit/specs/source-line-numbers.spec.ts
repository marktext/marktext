import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  ipcMain: { on: vi.fn(), emit: vi.fn(), handle: vi.fn() },
  BrowserWindow: { fromWebContents: vi.fn(), getAllWindows: vi.fn(() => []) }
}))
vi.mock('main_renderer/i18n', () => ({ t: (key: string) => key }))

import { formatSourceLineNumber } from '@/util/sourceLineNumbers'
import { toggleLineNumbers, viewLayoutChanged } from 'main_renderer/menu/actions/view'
import viewTemplate from 'main_renderer/menu/templates/view'

describe('source line numbers', () => {
  it('places the toggle immediately after Table of Contents', () => {
    const menu = viewTemplate({ getAccelerator: () => null } as never)
    const items = menu.submenu as Array<{ id?: string, type?: string, checked?: boolean }>
    const tocIndex = items.findIndex((item) => item.id === 'tocMenuItem')
    const toggle = items[tocIndex + 1]

    expect(toggle.id).toBe('lineNumbersMenuItem')
    expect(toggle.type).toBe('checkbox')
    expect(toggle.checked).toBe(true)
  })

  it('sends the line-number view toggle to the renderer', () => {
    const send = vi.fn()
    toggleLineNumbers({ webContents: { send } } as never)

    expect(send).toHaveBeenCalledWith('mt::toggle-view-mode-entry', 'lineNumbers')
  })

  it('keeps the application menu check in sync', () => {
    const item = { checked: true }
    const menu = { getMenuItemById: vi.fn(() => item) }

    viewLayoutChanged(menu as never, { lineNumbers: false })

    expect(item.checked).toBe(false)
  })

  it('formats every source line instead of only multiples of ten', () => {
    expect([1, 2, 9, 10, 11].map(formatSourceLineNumber)).toEqual([1, 2, 9, 10, 11])
  })
})
