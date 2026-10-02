import { beforeEach, describe, expect, it, vi } from 'vitest'

const { showMessageBox, trashItem, t } = vi.hoisted(() => ({
  showMessageBox: vi.fn(),
  trashItem: vi.fn(),
  t: vi.fn((key: string) => key)
}))

vi.mock('electron', () => ({
  BrowserWindow: class {},
  dialog: { showMessageBox },
  shell: { trashItem }
}))
vi.mock('main_renderer/i18n', () => ({ t }))

import { confirmAndTrashItem } from 'main_renderer/filesystem/trash'

const fakeWindow = {} as never

describe('confirmAndTrashItem', () => {
  beforeEach(() => {
    showMessageBox.mockReset()
    trashItem.mockReset()
    t.mockClear()
    trashItem.mockResolvedValue(undefined)
  })

  it('trashes only after the confirm button', async() => {
    showMessageBox.mockResolvedValue({ response: 0 })

    await expect(confirmAndTrashItem(fakeWindow, '/docs/notes.md')).resolves.toBe(true)
    expect(trashItem).toHaveBeenCalledWith('/docs/notes.md')
  })

  it('keeps the file when the dialog is cancelled', async() => {
    showMessageBox.mockResolvedValue({ response: 1 })

    await expect(confirmAndTrashItem(fakeWindow, '/docs/notes.md')).resolves.toBe(false)
    expect(trashItem).not.toHaveBeenCalled()
  })

  it('defaults focus to cancel and quotes the basename', async() => {
    showMessageBox.mockResolvedValue({ response: 1 })

    await confirmAndTrashItem(fakeWindow, '/docs/notes.md')

    const [, options] = showMessageBox.mock.calls[0] as [unknown, Record<string, unknown>]
    expect(options.defaultId).toBe(1)
    expect(options.cancelId).toBe(1)
    expect(options.buttons).toEqual(['contextMenu.sideBar.moveToTrash', 'dialog.cancel'])
    expect(t).toHaveBeenCalledWith('dialog.moveToTrash', { name: 'notes.md' })
  })

  it('shows a parent-less dialog when no window is available', async() => {
    showMessageBox.mockResolvedValue({ response: 1 })

    await confirmAndTrashItem(null, '/docs/notes.md')

    expect(showMessageBox).toHaveBeenCalledTimes(1)
    expect(showMessageBox.mock.calls[0]).toHaveLength(1)
  })
})
