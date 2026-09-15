import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { matchSupportedLanguage } from '../../../src/common/i18n'

interface MockI18nUtils {
  loadTranslations: Mock
}

// Window.i18nUtils is required in the runtime contextBridge typing, but in
// this unit test we install a mock with `vi.fn` and remove it between specs.
const win = window as unknown as { i18nUtils?: MockI18nUtils }

// The main process resolves the system locale to a supported UI language via
// matchSupportedLanguage on first start (after app ready — `app.getLocale()`
// is empty before that, see src/main/app/index.ts).
describe('common/i18n matchSupportedLanguage', () => {
  it('returns the locale itself when exactly supported', () => {
    expect(matchSupportedLanguage('zh-CN')).toBe('zh-CN')
    expect(matchSupportedLanguage('en')).toBe('en')
    expect(matchSupportedLanguage('zh-TW')).toBe('zh-TW')
  })

  it('returns null for an empty locale (app.getLocale() before ready)', () => {
    expect(matchSupportedLanguage('')).toBeNull()
  })

  it('falls back to the primary subtag for unsupported regions', () => {
    expect(matchSupportedLanguage('pt-PT')).toBe('pt')
    expect(matchSupportedLanguage('en-GB')).toBe('en')
    expect(matchSupportedLanguage('ja-JP')).toBe('ja')
    expect(matchSupportedLanguage('de-AT')).toBe('de')
  })

  it('splits the zh family by script: TW/HK/MO use traditional characters', () => {
    expect(matchSupportedLanguage('zh')).toBe('zh-CN')
    expect(matchSupportedLanguage('zh-SG')).toBe('zh-CN')
    expect(matchSupportedLanguage('zh-Hans')).toBe('zh-CN')
    expect(matchSupportedLanguage('zh-HK')).toBe('zh-TW')
    expect(matchSupportedLanguage('zh-MO')).toBe('zh-TW')
    expect(matchSupportedLanguage('zh-Hant')).toBe('zh-TW')
    expect(matchSupportedLanguage('zh-Hant-TW')).toBe('zh-TW')
  })

  it('returns null for languages without a supported translation', () => {
    expect(matchSupportedLanguage('ru-RU')).toBeNull()
    expect(matchSupportedLanguage('it')).toBeNull()
    expect(matchSupportedLanguage('xx-YY')).toBeNull()
  })
})

describe('renderer i18n language loading', () => {
  beforeEach(() => {
    vi.resetModules()
    win.i18nUtils = {
      loadTranslations: vi.fn((locale: string) => ({
        locale,
        menu: {
          file: {
            file: 'File'
          }
        }
      }))
    }
  })

  afterEach(() => {
    delete win.i18nUtils
  })

  it('does not reload the default English locale', async() => {
    const { setLanguage, getCurrentLanguage } = await import('../../../src/renderer/src/i18n')

    setLanguage('en')

    expect(win.i18nUtils!.loadTranslations).not.toHaveBeenCalled()
    expect(getCurrentLanguage()).to.equal('en')
  })

  it('loads an unavailable locale only once', async() => {
    const { setLanguage } = await import('../../../src/renderer/src/i18n')

    setLanguage('zh-CN')
    setLanguage('zh-CN')

    expect(win.i18nUtils!.loadTranslations).toHaveBeenCalledTimes(1)
    expect(win.i18nUtils!.loadTranslations).toHaveBeenCalledWith('zh-CN')
  })
})

// Issue #4046: exporting HTML/PDF surfaced an "Unexpected renderer process
// error" — a vue-i18n message-compiler SyntaxError (code 9,
// NOT_ALLOW_NEST_PLACEHOLDER) thrown while lazily compiling a translation whose
// value contained a nested placeholder (e.g. literal `{{type}}`). A single
// malformed translation must degrade to raw text, never crash the renderer.
describe('renderer i18n malformed-message resilience (issue #4046)', () => {
  beforeEach(() => {
    vi.resetModules()
    win.i18nUtils = { loadTranslations: vi.fn() }
  })

  afterEach(() => {
    delete win.i18nUtils
  })

  interface TestComposer {
    setLocaleMessage: (locale: string, message: Record<string, unknown>) => void
    locale: { value: string }
    t: (key: string, named?: Record<string, unknown>) => string
  }

  it('does not throw when a registered message contains a nested placeholder', async() => {
    const { i18n } = await import('../../../src/renderer/src/i18n')
    const composer = i18n.global as unknown as TestComposer

    composer.setLocaleMessage('xx', { export: { failed: 'Failed {{type}} export' } })
    composer.locale.value = 'xx'

    expect(() => composer.t('export.failed', { type: 'PDF' })).not.toThrow()
    expect(composer.t('export.failed', { type: 'PDF' })).toBe('Failed {{type}} export')
  })

  it('still interpolates well-formed messages', async() => {
    const { i18n } = await import('../../../src/renderer/src/i18n')
    const composer = i18n.global as unknown as TestComposer

    composer.setLocaleMessage('xx', { greeting: 'Hello {name}' })
    composer.locale.value = 'xx'

    expect(composer.t('greeting', { name: 'World' })).toBe('Hello World')
  })
})
