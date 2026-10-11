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
    trashItem.mockResolvedValue(undefined)
  })

  it('trashes only after the confirm button, and never on cancel', async() => {
    showMessageBox.mockResolvedValue({ response: 0 })
    await expect(confirmAndTrashItem(fakeWindow, '/docs/notes.md')).resolves.toBe(true)
    expect(trashItem).toHaveBeenCalledWith('/docs/notes.md')

    // Cancel must be the default so Enter/Esc keep the file.
    const [, options] = showMessageBox.mock.calls[0] as [unknown, Record<string, unknown>]
    expect(options.defaultId).toBe(1)

    showMessageBox.mockResolvedValue({ response: 1 })
    await expect(confirmAndTrashItem(fakeWindow, '/docs/notes.md')).resolves.toBe(false)
    expect(trashItem).toHaveBeenCalledTimes(1)
  })

  it('shows a parent-less dialog when no window is available', async() => {
    showMessageBox.mockResolvedValue({ response: 1 })

    await confirmAndTrashItem(null, '/docs/notes.md')

    expect(showMessageBox.mock.calls[0]).toHaveLength(1)
  })
})
