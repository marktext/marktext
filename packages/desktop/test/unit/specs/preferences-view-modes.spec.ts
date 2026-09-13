import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePreferencesStore } from '@/store/preferences'

describe('preferences view-mode toggles', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('enabling split view disables source-code mode', () => {
    const store = usePreferencesStore()
    store.SET_MODE({ type: 'sourceCode', checked: true })

    const changes = store.TOGGLE_VIEW_MODE('splitView')

    expect(store.splitView).toBe(true)
    expect(store.sourceCode).toBe(false)
    expect(changes).toEqual({ splitView: true, sourceCode: false })
  })

  it('enabling source-code mode disables split view', () => {
    const store = usePreferencesStore()
    store.SET_MODE({ type: 'splitView', checked: true })

    const changes = store.TOGGLE_VIEW_MODE('sourceCode')

    expect(store.sourceCode).toBe(true)
    expect(store.splitView).toBe(false)
    expect(changes).toEqual({ sourceCode: true, splitView: false })
  })

  it('can disable split view without changing source-code mode', () => {
    const store = usePreferencesStore()
    store.SET_MODE({ type: 'splitView', checked: true })

    const changes = store.TOGGLE_VIEW_MODE('splitView')

    expect(store.splitView).toBe(false)
    expect(store.sourceCode).toBe(false)
    expect(changes).toEqual({ splitView: false })
  })
})
