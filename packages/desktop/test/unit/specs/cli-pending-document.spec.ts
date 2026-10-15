import { describe, expect, it } from 'vitest'
import { createDocumentState, getOptionsFromState } from '@/store/help'

describe('named CLI buffer state (#2143)', () => {
  it('keeps creation state separate from unsaved edits, including after restoration', () => {
    const document = createDocumentState({
      pathname: '/notes/new.md',
      filename: 'new.md',
      markdown: '',
      isPendingCreation: true
    })
    expect(document.isSaved).toBe(true)
    expect(document.isPendingCreation).toBe(true)
    expect(getOptionsFromState(document).isPendingCreation).toBe(true)
    const restored = createDocumentState(JSON.parse(JSON.stringify(document)))
    expect(restored.pathname).toBe('/notes/new.md')
    expect(restored.isPendingCreation).toBe(true)
    expect(restored.isSaved).toBe(true)
  })
})
