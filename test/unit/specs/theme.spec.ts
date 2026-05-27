import { describe, it, expect } from 'vitest'
import { isDarkThemeId, railscastsThemes, oneDarkThemes } from 'common/theme'

describe('railscastsThemes', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(railscastsThemes)).toBe(true)
  })

  it('contains canonical dark themes', () => {
    expect(railscastsThemes).toContain('dark')
    expect(railscastsThemes).toContain('dracula')
    expect(railscastsThemes).toContain('nord')
  })

  it('has no duplicate entries', () => {
    expect(new Set(railscastsThemes).size).toBe(railscastsThemes.length)
  })
})

describe('oneDarkThemes', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(oneDarkThemes)).toBe(true)
  })

  it('contains "one-dark"', () => {
    expect(oneDarkThemes).toContain('one-dark')
  })
})

describe('isDarkThemeId', () => {
  it('returns true for every railscastsTheme', () => {
    for (const theme of railscastsThemes) {
      expect(isDarkThemeId(theme)).toBe(true)
    }
  })

  it('returns true for every oneDarkTheme', () => {
    for (const theme of oneDarkThemes) {
      expect(isDarkThemeId(theme)).toBe(true)
    }
  })

  it('returns false for known light themes', () => {
    const lightThemes = ['light', 'graphite', 'ulysses', 'tokyo-night-light']
    for (const theme of lightThemes) {
      expect(isDarkThemeId(theme)).toBe(false)
    }
  })

  it('returns false for an empty string', () => {
    expect(isDarkThemeId('')).toBe(false)
  })

  it('returns false for an unknown string', () => {
    expect(isDarkThemeId('completely-unknown-theme')).toBe(false)
  })

  it('returns false for null', () => {
    expect(isDarkThemeId(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isDarkThemeId(undefined)).toBe(false)
  })

  it('returns false for a number', () => {
    expect(isDarkThemeId(42)).toBe(false)
  })

  it('returns false for an object', () => {
    expect(isDarkThemeId({ theme: 'dark' })).toBe(false)
  })

  it('returns false for an array', () => {
    expect(isDarkThemeId(['dark'])).toBe(false)
  })

  it('is case-sensitive (uppercase variant is not dark)', () => {
    // 'DARK' is not in the dark list — the function should return false
    expect(isDarkThemeId('DARK')).toBe(false)
    expect(isDarkThemeId('Nord')).toBe(false)
  })
})
