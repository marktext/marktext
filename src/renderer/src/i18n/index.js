import { createI18n } from 'vue-i18n'
import bus from '../bus'

// Directly import translation files
import enTranslations from '../../../../static/locales/en.json'

// Create the Vue i18n instance
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
    compile: (message) => {
      // If the message contains '|', return the raw string without plural parsing
      if (typeof message === 'string' && message.includes('|')) {
        return () => message
      }
      // For other messages, use the default compiler
      return null
    }
  }
})

// Export the translation function - Fix: correctly handle the Vue i18n v9+ global getter
export const t = (key, ...args) => {
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

    return i18n.global.t(key, ...args)
  } catch (error) {
    console.error('❌ 翻译函数执行错误:', error)
    return key
  }
}

// Export language setter function
export const setLanguage = (locale) => {
  if (!locale) return
  if (!i18n.global.availableLocales.includes(locale)) {
    // Locale not yet available, need to get it from the main process
    const translation = window.i18nUtils.loadTranslations(locale)
    if (!translation) return // Failed to load locale file, error msg should be in the loadTranslations function

    // Add the loaded locale to i18n instance
    i18n.global.setLocaleMessage(locale, translation)
    console.log(`🌐 Loaded and set new locale: ${locale}`)
  }
  i18n.global.locale.value = locale
}

// Export the current language getter function
export const getCurrentLanguage = () => i18n.global.locale.value

// Export the i18n instance (named and default export)
export { i18n }
export default i18n

// Listen for language changes
if (window.electron && window.electron.ipcRenderer) {
  window.electron.ipcRenderer.on('language-changed', (event, newLocale) => {
    setLanguage(newLocale)
    bus.emit('language-changed', newLocale)
  })

  // Request the current language setting at startup
  window.electron.ipcRenderer.send('mt::get-current-language')
  window.electron.ipcRenderer.on('mt::current-language', (event, language) => {
    setLanguage(language)
    bus.emit('language-changed', language)
  })
}
