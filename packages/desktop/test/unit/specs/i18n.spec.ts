import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'

interface MockI18nUtils {
  loadTranslations: Mock
}

// Window.i18nUtils is required in the runtime contextBridge typing, but in
// this unit test we install a mock with `vi.fn` and remove it between specs.
const win = window as unknown as { i18nUtils?: MockI18nUtils }

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
