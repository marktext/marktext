import { getTranslation } from 'common/i18n'
import { BrowserWindow } from 'electron'

// Current language setting (can be obtained from config file or user settings)
let currentLanguage = 'en'

/**
 * Gets the translated text.
 */
export function t(key: string, params: Record<string, string | number> = {}): string {
  return getTranslation(key, currentLanguage, params)
}

/**
 * Gets the current language.
 */
export function getCurrentLanguage(): string {
  return currentLanguage
}

/**
 * Sets the language.
 */
export function setLanguage(language: string): void {
  currentLanguage = language

  const windows = BrowserWindow.getAllWindows()
  windows.forEach((window) => {
    if (window && !window.isDestroyed()) {
      window.webContents.send('language-changed', language)
    }
  })
}
