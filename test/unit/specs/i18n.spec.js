describe('renderer i18n language loading', () => {
  beforeEach(() => {
    vi.resetModules()
    window.i18nUtils = {
      loadTranslations: vi.fn(locale => ({
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
    delete window.i18nUtils
  })

  it('does not reload the default English locale', async() => {
    const { setLanguage, getCurrentLanguage } = await import('../../../src/renderer/src/i18n')

    setLanguage('en')

    expect(window.i18nUtils.loadTranslations).not.toHaveBeenCalled()
    expect(getCurrentLanguage()).to.equal('en')
  })

  it('loads an unavailable locale only once', async() => {
    const { setLanguage } = await import('../../../src/renderer/src/i18n')

    setLanguage('zh-CN')
    setLanguage('zh-CN')

    expect(window.i18nUtils.loadTranslations).toHaveBeenCalledTimes(1)
    expect(window.i18nUtils.loadTranslations).toHaveBeenCalledWith('zh-CN')
  })
})
