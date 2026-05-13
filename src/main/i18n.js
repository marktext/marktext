import { getTranslation } from '../common/i18n'
import { BrowserWindow } from 'electron'

// Current language setting (can be obtained from config file or user settings)
let currentLanguage = 'en'

/**
 * Gets the translated text
 * @param {string} key - Translation key
 * @param {object} params - Parameter object
 * @returns {string} Translated text
 */
export function t(key, params = {}) {
  return getTranslation(key, currentLanguage, params)
}

/**
 * Gets the current language
 * @returns {string} Current language code
 */
export function getCurrentLanguage() {
  return currentLanguage
}

/**
 * Sets the language
 * @param {string} language - Language code
 */
export function setLanguage(language) {
  currentLanguage = language

  const windows = BrowserWindow.getAllWindows()
  windows.forEach((window) => {
    if (window && !window.isDestroyed()) {
      window.webContents.send('language-changed', language)
    }
  })
}
