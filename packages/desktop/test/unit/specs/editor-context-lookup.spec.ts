import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shell } from 'electron'

vi.mock('electron', () => ({
  shell: {
    openExternal: vi.fn()
  }
}))

const { getLookUp, lookUpSelection } = await import('main_renderer/contextMenu/editor/menuItems')

describe('editor context menu Look Up', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens selected text with the macOS Dictionary URL scheme', () => {
    expect(lookUpSelection(' apple ')).toBe(true)

    expect(shell.openExternal).toHaveBeenCalledWith('dict://apple')
  })

  it('URL-encodes spaces and unicode characters', () => {
    expect(lookUpSelection('cafe au lait')).toBe(true)
    expect(lookUpSelection('na\u00efve fa\u00e7ade')).toBe(true)

    expect(shell.openExternal).toHaveBeenNthCalledWith(1, 'dict://cafe%20au%20lait')
    expect(shell.openExternal).toHaveBeenNthCalledWith(2, 'dict://na%C3%AFve%20fa%C3%A7ade')
  })

  it('does not open Dictionary for blank selections', () => {
    expect(lookUpSelection('   ')).toBe(false)

    expect(shell.openExternal).not.toHaveBeenCalled()
  })

  it('wires the context-menu item to the lookup action', () => {
    const item = getLookUp(' markdown ')

    item.click?.({} as never, undefined as never, {} as never)

    expect(item.id).toBe('lookUpMenuItem')
    expect(shell.openExternal).toHaveBeenCalledWith('dict://markdown')
  })
})
