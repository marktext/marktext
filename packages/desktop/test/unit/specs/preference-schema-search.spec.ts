import { expect, it, vi } from 'vitest'
import { getTranslatedSearchContent, matchesSearch } from '../../../src/renderer/src/prefComponents/sideBar/config'

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
    preference: 'preferences.markdown.extensions.fancyLists'
  })
})

it('includes auxiliary controls and searches real labels, descriptions and stable IDs', () => {
  const entries = getTranslatedSearchContent()
  for (const key of ['treePathExcludePatterns', 'customCss', 'imageFolderPath', 'imageUploader']) {
    expect(entries.some(entry => entry.key === key)).toBe(true)
  }
  const task = entries.find(entry => entry.key === 'autoCheck')
  expect(task).toBeDefined()
  if (!task) return
  expect(matchesSearch(task, 'parent subtasks')).toBe(true)
  expect(matchesSearch(task, 'autoCheck')).toBe(true)
  expect(matchesSearch(task, 'encoding')).toBe(false)
})
