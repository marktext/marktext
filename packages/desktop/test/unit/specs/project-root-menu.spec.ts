import { describe, expect, it, vi } from 'vitest'
const popup = vi.hoisted(() => vi.fn())
vi.mock('@/contextMenu/popupMenu', () => ({ popupContextMenu: popup }))
import { showRootContextMenu } from '@/contextMenu/sideBar'
import type { ContextMenuItem } from '@/contextMenu/popupMenu'

describe('root folder context menu (#2222)', () => {
  it('unloads roots without exposing disk deletion, rename or cut', () => {
    const remove = vi.fn()
    showRootContextMenu({ clientX: 1, clientY: 2 }, false, true, remove, vi.fn())
    const items = popup.mock.lastCall?.[0] as ContextMenuItem[]
    const labels = items.map((item) => item.label)
    expect(labels).toContain('Remove from Sidebar')
    expect(labels).not.toContain('Move to Trash')
    expect(labels).not.toContain('Rename')
    expect(labels).not.toContain('Cut')
    items.find((item) => item.label === 'Remove from Sidebar')?.click?.()
    expect(remove).toHaveBeenCalledOnce()
    expect(items.find((item) => item.label === 'Paste')?.enabled).toBe(false)
  })

  it('allows unavailable roots to retry or be removed without offering file creation', () => {
    const retry = vi.fn()
    showRootContextMenu({ clientX: 1, clientY: 2 }, true, false, vi.fn(), retry)
    const items = popup.mock.lastCall?.[0] as ContextMenuItem[]
    expect(items.map((item) => item.label)).not.toContain('New File')
    items.find((item) => item.label === 'Retry')?.click?.()
    expect(retry).toHaveBeenCalledOnce()
  })
})
