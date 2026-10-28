import { expect, it, vi } from 'vitest'
import { getTranslatedSearchContent } from '../../../src/renderer/src/prefComponents/sideBar/config'

vi.mock('../../../src/renderer/src/i18n', () => ({ t: (key: string) => key }))

it('indexes startup restoration controls alongside existing preferences', () => {
  const entries = getTranslatedSearchContent()
  for (const key of ['autoSave', 'language', 'restoreLayoutState', 'restoreEditors', 'restoreViewState']) {
    expect(entries.find(entry => entry.key === key)).toMatchObject({
      routeCategory: 'general',
      categoryEn: 'General',
      description: expect.any(String)
    })
  }
})

it('routes the fancy-list search result to Markdown preferences', () => {
  const entry = getTranslatedSearchContent().find(entry => entry.key === 'fancyLists')
  expect(entry).toMatchObject({
    routeCategory: 'markdown',
    categoryEn: 'Markdown',
    preference: 'preferences.search.items.fancyLists'
  })
})
