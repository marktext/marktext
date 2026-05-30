import { describe, it, expect } from 'vitest'
import { matchSystemLocale } from '../../../src/common/i18n'

describe('matchSystemLocale', () => {
  it('matches an exact supported BCP 47 tag', () => {
    expect(matchSystemLocale('zh-CN')).toBe('zh-CN')
    expect(matchSystemLocale('en')).toBe('en')
    expect(matchSystemLocale('de')).toBe('de')
  })

  it('falls back to the primary subtag', () => {
    expect(matchSystemLocale('de-DE')).toBe('de')
    expect(matchSystemLocale('fr-CA')).toBe('fr')
    expect(matchSystemLocale('pt-BR')).toBe('pt')
  })

  it('normalizes POSIX locale strings from env vars', () => {
    expect(matchSystemLocale('de_DE.UTF-8')).toBe('de')
    expect(matchSystemLocale('ja_JP.UTF-8')).toBe('ja')
    expect(matchSystemLocale('de_DE@euro')).toBe('de')
  })

  it('prefers a region variant for ambiguous primary subtags', () => {
    // 'zh' alone is not a supported tag; the primary-subtag fallback must pick a
    // concrete supported variant rather than returning null.
    expect(matchSystemLocale('zh')).toBe('zh-CN')
    expect(matchSystemLocale('zh-Hant')).toBe('zh-CN')
  })

  it('never matches an empty or absent locale to a language', () => {
    // Regression: before the fix, an empty primary subtag made
    // `supportedLanguages.find(lang => lang.startsWith(''))` return the first
    // language ('en'), so a German system silently showed English. An empty
    // locale (what `app.getLocale()` returns before the Electron 'ready' event
    // on Linux) must yield null so the next candidate source is consulted.
    expect(matchSystemLocale('')).toBeNull()
    expect(matchSystemLocale(undefined)).toBeNull()
    expect(matchSystemLocale(null)).toBeNull()
    expect(matchSystemLocale('C')).toBeNull()
    expect(matchSystemLocale('POSIX')).toBeNull()
  })

  it('returns null for an unsupported but well-formed locale', () => {
    expect(matchSystemLocale('ru-RU')).toBeNull()
    expect(matchSystemLocale('it')).toBeNull()
  })
})
