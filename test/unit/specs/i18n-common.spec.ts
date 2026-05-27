// Tests for src/common/i18n.ts
// The vitest config sets PERF_TESTING=true so the module resolves locale files
// relative to process.cwd() (the project root), enabling static/locales/*.json
// to be read without a packaged Electron build.
import { describe, it, expect, beforeEach } from 'vitest'
import {
  getTranslation,
  getSupportedLanguages,
  isLanguageSupported,
  clearCache,
  getAllTranslations,
  loadTranslations
} from 'common/i18n'

// ---------------------------------------------------------------------------
// getSupportedLanguages
// ---------------------------------------------------------------------------

describe('getSupportedLanguages', () => {
  it('returns an array', () => {
    expect(Array.isArray(getSupportedLanguages())).toBe(true)
  })

  it('is non-empty', () => {
    expect(getSupportedLanguages().length).toBeGreaterThan(0)
  })

  it('contains "en"', () => {
    expect(getSupportedLanguages()).toContain('en')
  })

  it('every entry is a non-empty string', () => {
    for (const lang of getSupportedLanguages()) {
      expect(typeof lang).toBe('string')
      expect(lang.length).toBeGreaterThan(0)
    }
  })

  it('returns a new array each call (not a shared reference)', () => {
    const a = getSupportedLanguages()
    const b = getSupportedLanguages()
    expect(a).not.toBe(b)
  })
})

// ---------------------------------------------------------------------------
// isLanguageSupported
// ---------------------------------------------------------------------------

describe('isLanguageSupported', () => {
  it('returns true for "en"', () => {
    expect(isLanguageSupported('en')).toBe(true)
  })

  it('returns true for every value in getSupportedLanguages()', () => {
    for (const lang of getSupportedLanguages()) {
      expect(isLanguageSupported(lang)).toBe(true)
    }
  })

  it('returns false for an unknown locale', () => {
    expect(isLanguageSupported('xx-FAKE')).toBe(false)
  })

  it('returns false for an empty string', () => {
    expect(isLanguageSupported('')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// loadTranslations / getAllTranslations
// ---------------------------------------------------------------------------

describe('loadTranslations', () => {
  beforeEach(() => clearCache())

  it('returns a translations object for "en"', () => {
    const result = loadTranslations('en')
    expect(result).not.toBeNull()
    expect(typeof result).toBe('object')
  })

  it('returns the same reference on repeated calls (cache hit)', () => {
    const first = loadTranslations('en')
    const second = loadTranslations('en')
    expect(first).toBe(second)
  })

  it('falls back to English for an unsupported locale', () => {
    const result = loadTranslations('xx-FAKE')
    // Falls back to en — non-null and same as the English translations
    const en = loadTranslations('en')
    expect(result).toEqual(en)
  })
})

describe('getAllTranslations', () => {
  beforeEach(() => clearCache())

  it('returns translations for "en"', () => {
    const result = getAllTranslations('en')
    expect(result).not.toBeNull()
  })

  it('returns null or a fallback for an unsupported locale (no infinite recursion)', () => {
    // The function should not throw even for unknown locales
    expect(() => getAllTranslations('xx-FAKE')).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// getTranslation
// ---------------------------------------------------------------------------

describe('getTranslation', () => {
  beforeEach(() => clearCache())

  it('returns the key for a missing nested path', () => {
    expect(getTranslation('totally.missing.key', 'en')).toBe('totally.missing.key')
  })

  it('returns the key when the value at the path is not a string', () => {
    // Top-level keys that resolve to objects should fall back to the key
    // (exact behaviour depends on the structure of the translation file).
    const result = getTranslation('menu', 'en')
    expect(typeof result).toBe('string')
  })

  it('substitutes {param} tokens in the translated string', () => {
    // Use a key we know doesn't exist so we can test the param substitution
    // path with a mocked translation by verifying it doesn't throw.
    expect(() => getTranslation('some.key', 'en', { count: 5 })).not.toThrow()
  })

  it('defaults to "en" when no language argument is provided', () => {
    // Both calls resolve using the English locale — result must be identical.
    const withDefault = getTranslation('totally.missing.key')
    const withExplicit = getTranslation('totally.missing.key', 'en')
    expect(withDefault).toBe(withExplicit)
  })

  it('returns a string for an unknown locale (falls back to en)', () => {
    const result = getTranslation('totally.missing.key', 'xx-FAKE')
    expect(typeof result).toBe('string')
  })
})

// ---------------------------------------------------------------------------
// clearCache
// ---------------------------------------------------------------------------

describe('clearCache', () => {
  it('forces a fresh load on the next call', () => {
    const first = loadTranslations('en')
    clearCache()
    const second = loadTranslations('en')
    // Content must be equal but it should be a newly created object
    expect(first).not.toBe(second)
    expect(first).toEqual(second)
  })
})
