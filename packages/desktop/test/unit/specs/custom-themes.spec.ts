import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  setCustomThemes,
  getCustomTheme,
  getCustomThemes,
  loadCustomThemes
} from '@/util/customThemes'
import type { CustomThemeDescriptor } from '@shared/types/theme'

const make = (
  id: string,
  name: string,
  type: 'light' | 'dark' = 'light'
): CustomThemeDescriptor => ({
  id: `custom:${id}`,
  fileId: id,
  name,
  type,
  css: ':root {}'
})

const stubListCustom = (impl: () => Promise<CustomThemeDescriptor[]>): void => {
  window.themes = {
    listCustom: impl,
    importCustom: vi.fn(),
    openFolder: vi.fn()
  } as unknown as typeof window.themes
}

beforeEach(() => {
  setCustomThemes([])
})

describe('custom theme registry', () => {
  it('stores and retrieves a theme by its runtime id', () => {
    const theme = make('cool', 'Cool')
    setCustomThemes([theme])
    expect(getCustomTheme('custom:cool')).to.deep.equal(theme)
  })

  it('returns undefined for an unknown id', () => {
    expect(getCustomTheme('custom:missing')).to.equal(undefined)
  })

  it('replaces previous contents on each set', () => {
    setCustomThemes([make('a', 'A')])
    setCustomThemes([make('b', 'B')])
    expect(getCustomTheme('custom:a')).to.equal(undefined)
    expect(getCustomTheme('custom:b')).to.not.equal(undefined)
  })

  it('lists themes sorted by display name', () => {
    setCustomThemes([make('z', 'Zen'), make('a', 'Apple'), make('m', 'Mango')])
    expect(getCustomThemes().map((theme) => theme.name)).to.deep.equal(['Apple', 'Mango', 'Zen'])
  })
})

describe('loadCustomThemes', () => {
  it('populates the registry from window.themes.listCustom', async() => {
    const themes = [make('one', 'One'), make('two', 'Two', 'dark')]
    stubListCustom(() => Promise.resolve(themes))
    const result = await loadCustomThemes()
    expect(result).to.have.length(2)
    expect(getCustomTheme('custom:two')?.type).to.equal('dark')
  })

  it('returns an empty array and does not throw when the IPC call fails', async() => {
    stubListCustom(() => Promise.reject(new Error('boom')))
    const result = await loadCustomThemes()
    expect(result).to.deep.equal([])
  })

  it('clears previously loaded themes when a later refresh fails', async() => {
    stubListCustom(() => Promise.resolve([make('one', 'One')]))
    await loadCustomThemes()
    expect(getCustomTheme('custom:one')).to.not.equal(undefined)

    stubListCustom(() => Promise.reject(new Error('boom')))
    await loadCustomThemes()
    expect(getCustomTheme('custom:one')).to.equal(undefined)
    expect(getCustomThemes()).to.deep.equal([])
  })
})
