import { beforeEach, describe, expect, it, vi } from 'vitest'

const { confirm, save, notify, file, store, preferences } = vi.hoisted(() => {
  const file = {
    id: 'original',
    pathname: '',
    isPendingCreation: false,
    readOnly: false,
    modeChanging: false
  }
  const save = vi.fn()
  return {
    confirm: vi.fn(),
    save,
    notify: vi.fn(),
    file,
    store: { currentFile: file, FILE_SAVE: save },
    preferences: { imageInsertAction: 'folder', imagePreferRelativeDirectory: true }
  }
})

vi.mock('element-plus', () => ({ ElMessageBox: { confirm } }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('@/store/editor', () => ({ useEditorStore: () => store }))
vi.mock('@/store/preferences', () => ({ usePreferencesStore: () => preferences }))
vi.mock('@/services/notification', () => ({ default: { notify } }))

import { beforeImageDrop } from '@/services/imageDrop'

describe('dropped images in a never-saved document', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(file, {
      id: 'original',
      pathname: '',
      isPendingCreation: false,
      readOnly: false,
      modeChanging: false
    })
    store.currentFile = file
    Object.assign(preferences, { imageInsertAction: 'folder', imagePreferRelativeDirectory: true })
    confirm.mockResolvedValue('confirm')
    save.mockImplementation(async() => {
      file.pathname = '/notes/demo.md'
      file.isPendingCreation = false
      return { status: 'saved' }
    })
  })

  it('waits for the save choice before processing the image', async() => {
    let chooseSave!: (value: string) => void
    confirm.mockReturnValueOnce(
      new Promise((resolve) => {
        chooseSave = resolve
      })
    )
    const result = beforeImageDrop()
    expect(save).not.toHaveBeenCalled()
    expect(confirm).toHaveBeenCalledWith(
      'editor.imageDrop.saveMessage',
      'editor.imageDrop.saveTitle',
      expect.objectContaining({
        confirmButtonText: 'dialog.save',
        cancelButtonText: 'common.cancel'
      })
    )
    chooseSave('confirm')
    expect(await result).toBe(true)
    expect(file.pathname).toBe('/notes/demo.md')
    expect(save).toHaveBeenCalledOnce()
  })

  it.each(['cancel', 'close'])(
    'uses the original image action after dismissing the prompt with %s',
    async(reason) => {
      confirm.mockRejectedValueOnce(reason)
      expect(await beforeImageDrop()).toBe(true)
      expect(save).not.toHaveBeenCalled()
      expect(file.pathname).toBe('')
      expect(notify).not.toHaveBeenCalled()
    }
  )

  it('continues with the original action when the native save dialog is canceled', async() => {
    save.mockResolvedValueOnce({ status: 'canceled' })
    expect(await beforeImageDrop()).toBe(true)
    expect(file.pathname).toBe('')
    expect(notify).not.toHaveBeenCalled()
  })

  it('stops on a failed save instead of treating it as cancellation', async() => {
    save.mockResolvedValueOnce({ status: 'failed' })
    expect(await beforeImageDrop()).toBe(false)
  })

  it('prompts for a CLI buffer that has a path but has not been created', async() => {
    Object.assign(file, { pathname: '/notes/new.md', isPendingCreation: true })
    await beforeImageDrop()
    expect(confirm).toHaveBeenCalledOnce()
    expect(save).toHaveBeenCalledOnce()
  })

  it.each(['folder', 'upload', 'path'])(
    'keeps existing %s behavior when a prompt is unnecessary',
    async(mode) => {
      preferences.imageInsertAction = mode
      if (mode === 'folder') file.pathname = '/notes/existing.md'
      expect(beforeImageDrop()).toBeUndefined()
      expect(confirm).not.toHaveBeenCalled()
      expect(save).not.toHaveBeenCalled()
    }
  )

  it('keeps the global-directory behavior when relative directories are disabled', async() => {
    preferences.imagePreferRelativeDirectory = false
    expect(beforeImageDrop()).toBeUndefined()
    expect(confirm).not.toHaveBeenCalled()
  })

  it('does not save or insert into a different tab after the prompt', async() => {
    confirm.mockImplementationOnce(async() => {
      store.currentFile = { ...file, id: 'other' }
      return 'confirm'
    })
    expect(await beforeImageDrop()).toBe(false)
    expect(save).not.toHaveBeenCalled()
  })

  it('stops if the document changes while saving', async() => {
    save.mockImplementationOnce(async() => {
      store.currentFile = { ...file, id: 'other' }
      return { status: 'saved' }
    })
    expect(await beforeImageDrop()).toBe(false)
  })

  it('ignores another drop while a save choice is pending', async() => {
    let chooseSave!: (value: string) => void
    confirm.mockReturnValueOnce(
      new Promise((resolve) => {
        chooseSave = resolve
      })
    )
    const first = beforeImageDrop()
    expect(await beforeImageDrop()).toBe(false)
    expect(confirm).toHaveBeenCalledOnce()
    chooseSave('confirm')
    await first
  })

  it('reports unexpected save errors and allows another attempt', async() => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      save.mockRejectedValueOnce(new Error('IPC failed'))
      expect(await beforeImageDrop()).toBe(false)
      expect(notify).toHaveBeenCalledWith({ title: 'editor.imageDrop.failed', type: 'error' })
      expect(await beforeImageDrop()).toBe(true)
    } finally {
      log.mockRestore()
    }
  })
})
