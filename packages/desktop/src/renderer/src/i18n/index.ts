import { createI18n } from 'vue-i18n'
import bus from '../bus'

// Directly import translation files
import enTranslations from '../../../../static/locales/en.json'

// Create the Vue i18n instance.
// vue-i18n's options type intersection between Composition + Legacy modes is
// notoriously difficult to satisfy with mixed shapes; we cast the options once
// at the call site rather than spreading `any` further.
const i18n = createI18n({
  legacy: false,
  locale: 'en', // default is en
  fallbackLocale: 'en',
  messages: { en: enTranslations }, // Load en by default only
  // Disable linking to avoid '@' symbols being misinterpreted
  modifiers: {
    '@': () => '@'
  },
  // Disable plural parsing
  pluralRules: {},
  // Custom message compiler to handle '|' characters
  messageCompiler: {
    compile: (message: unknown) => {
      // If the message contains '|', return the raw string without plural parsing
      if (typeof message === 'string' && message.includes('|')) {
        return () => message
      }
      // For other messages, use the default compiler
      return null
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any)

// Export the translation function - Fix: correctly handle the Vue i18n v9+ global getter
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const t = (key: string, ...args: any[]): string => {
  // Check if the i18n instance is available
  if (!i18n) {
    console.warn('⚠️ i18n实例不可用，使用英文fallback')
    return key
  }

  try {
    // Correctly access the global property
    if (!i18n.global) {
      console.warn('⚠️ i18n.global not ready yet, falling back to EN')
      return key
    }

    // vue-i18n's `t` is heavily overloaded; the variadic call signature here
    // intentionally bypasses the strict overload set.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (i18n.global.t as any)(key, ...args)
  } catch (error) {
    console.error('❌ 翻译函数执行错误:', error)
    return key
  }
}

// Cache in-flight translation loads so that concurrent setLanguage() calls
// don't fire duplicate IPCs for the same locale.
const inflightLoads = new Map<string, Promise<Record<string, unknown> | undefined>>()

// Export language setter function
export const setLanguage = async(locale: string): Promise<void> => {
  if (!locale) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globalI18n = i18n.global as any
  if (!globalI18n.availableLocales.includes(locale)) {
    let pending = inflightLoads.get(locale)
    if (!pending) {
      pending = Promise.resolve(window.i18nUtils.loadTranslations(locale)).finally(() =>
        inflightLoads.delete(locale)
      )
      inflightLoads.set(locale, pending)
    }
    const translation = await pending
    if (!translation) return // Failed to load locale file

    if (!globalI18n.availableLocales.includes(locale)) {
      globalI18n.setLocaleMessage(locale, translation)
      console.log(`🌐 Loaded and set new locale: ${locale}`)
    }
  }
  globalI18n.locale.value = locale
}

// Export the current language getter function
export const getCurrentLanguage = (): string => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (i18n.global as any).locale.value
}

// Export the i18n instance (named and default export)
export { i18n }
export default i18n

// Listen for language changes
if (window.electron && window.electron.ipcRenderer) {
  window.electron.ipcRenderer.on('language-changed', (_event, newLocale) => {
    setLanguage(newLocale)
    bus.emit('language-changed', newLocale)
  })

  // Request the current language setting at startup
  window.electron.ipcRenderer.send('mt::get-current-language')
  window.electron.ipcRenderer.on('mt::current-language', (_event, language) => {
    setLanguage(language)
    bus.emit('language-changed', language)
  })
}
