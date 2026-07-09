import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  process.env.PERF_TESTING = 'true'
})

const { getLookUp, lookUpSelection } = await import('main_renderer/contextMenu/editor/menuItems')

describe('editor context menu Look Up', () => {
  const showDefinitionForSelection = vi.fn()
  const targetWindow = {
    webContents: {
      showDefinitionForSelection
    }
  } as never

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the native macOS lookup panel for selected text', () => {
    expect(lookUpSelection(' apple ', targetWindow)).toBe(true)

    expect(showDefinitionForSelection).toHaveBeenCalledOnce()
  })

  it('does not show the lookup panel for blank selections', () => {
    expect(lookUpSelection('   ', targetWindow)).toBe(false)

    expect(showDefinitionForSelection).not.toHaveBeenCalled()
  })

  it('does not show the lookup panel without a target window', () => {
    expect(lookUpSelection('markdown')).toBe(false)

    expect(showDefinitionForSelection).not.toHaveBeenCalled()
  })

  it('wires the context-menu item to the lookup action', () => {
    const item = getLookUp(' markdown ')

    item.click?.({} as never, targetWindow, {} as never)

    expect(item.id).toBe('lookUpMenuItem')
    expect(item.label).toBe('Look Up "markdown"')
    expect(showDefinitionForSelection).toHaveBeenCalledOnce()
  })

  it('renders lookup labels with literal dollar-sign replacement patterns', () => {
    const item = getLookUp(" $& a$'b $$ $1 ")

    expect(item.label).toBe('Look Up "$& a$\'b $$ $1"')
  })
})
