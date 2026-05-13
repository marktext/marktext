import fs from 'fs'
import path from 'path'

// List of supported languages
const SUPPORTED_LANGUAGES = ['en', 'zh-CN', 'zh-TW', 'es', 'fr', 'de', 'ja', 'ko', 'pt']

// Translation data cache
let translationsCache = {}

/**
 * Loads the translation file for the specified language
 * @param {string} language - Language code
 * @returns {object} Translation data
 */
function loadTranslations(language) {
  if (translationsCache[language]) {
    return translationsCache[language]
  }

  try {
    // Since this script is used in both main and preload processes, we can't use global.__static directly here since it is only for the main process
    const localePath =
      process.env.NODE_ENV === 'development' || process.env.PERF_TESTING === 'true'
        ? path.join(process.cwd(), 'static', 'locales', `${language}.min.json`)
        : path.join(process.resourcesPath, 'static', 'locales', `${language}.min.json`)

    if (!fs.existsSync(localePath)) {
      throw new Error(`Translation file not found for language: ${language}`)
    }

    const content = fs.readFileSync(localePath, 'utf8')

    const translationData = JSON.parse(content)

    translationsCache[language] = translationData
    return translationData
  } catch (error) {
    // Fallback to English
    console.error('Error loading translation:', error)
    if (language !== 'en') {
      return loadTranslations('en')
    }
    return null
  }
}

/**
 * Gets the translated text
 * @param {string} key - Translation key, supports dot-separated nested keys
 * @param {string} language - Language code
 * @param {object} params - Parameter replacement object
 * @returns {string} Translated text
 */
function getTranslation(key, language = 'en', params = {}) {
  const translations = loadTranslations(language)

  if (!translations) {
    return key
  }

  // Supports dot-separated nested keys
  const keys = key.split('.')
  let probe = translations

  for (const segment of keys) {
    // Navigate through nested objects until the string
    if (segment in probe) {
      probe = probe[segment]
    } else {
      return key // Unable to find key, return the key itself
    }
  }

  if (typeof probe !== 'string') {
    return key // If the final value is not a string, return the key
  }

  // Parameter substitutions, for example "My name is: {name}"
  for (const [param, replacement] of Object.entries(params)) {
    probe = probe.replace(new RegExp(`\\{${param}\\}`, 'g'), replacement)
  }

  return probe
}

/**
 * Gets the list of supported languages
 * @returns {string[]} Array of supported language codes
 */
function getSupportedLanguages() {
  return [...SUPPORTED_LANGUAGES]
}

/**
 * Checks if a language is supported
 * @param {string} language - Language code
 * @returns {boolean} Whether the language is supported
 */
function isLanguageSupported(language) {
  return SUPPORTED_LANGUAGES.includes(language)
}

/**
 * Clear translation cache
 */
function clearCache() {
  translationsCache = {}
}

/**
 * Get all translation data for the specified language
 * @param {string} language - Language code
 * @returns {object} Complete translation data object
 */
function getAllTranslations(language) {
  return loadTranslations(language)
}

export {
  getTranslation,
  getSupportedLanguages,
  isLanguageSupported,
  clearCache,
  getAllTranslations,
  loadTranslations
}
