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
