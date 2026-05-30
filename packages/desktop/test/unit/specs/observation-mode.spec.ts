import { describe, it, expect } from 'vitest'
import { shouldAutoReload } from '@/store/observationMode'

describe('shouldAutoReload', () => {
  it('always reloads an observed tab regardless of autoSave/isSaved', () => {
    for (const autoSave of [true, false]) {
      for (const isSaved of [true, false]) {
        expect(shouldAutoReload({ isObserved: true, isSaved }, autoSave)).toBe(true)
      }
    }
  })

  it('reloads when not observed but autoSave is on and the tab is saved (legacy behaviour)', () => {
    expect(shouldAutoReload({ isObserved: false, isSaved: true }, true)).toBe(true)
  })

  it('does not reload when not observed and autoSave is off', () => {
    expect(shouldAutoReload({ isObserved: false, isSaved: true }, false)).toBe(false)
    expect(shouldAutoReload({ isObserved: false, isSaved: false }, false)).toBe(false)
  })

  it('does not reload when not observed, autoSave is on, but the tab is unsaved', () => {
    expect(shouldAutoReload({ isObserved: false, isSaved: false }, true)).toBe(false)
  })
})
