import { getTranslation } from 'common/i18n'
import { BrowserWindow } from 'electron'

let currentLanguage = 'en'

export function t(key: string, params: Record<string, string | number> = {}): string {
  return getTranslation(key, currentLanguage, params)
}

export function getCurrentLanguage(): string {
  return currentLanguage
}

export function setLanguage(language: string): void {
  currentLanguage = language

  const windows = BrowserWindow.getAllWindows()
  windows.forEach((window) => {
    if (window && !window.isDestroyed()) {
      window.webContents.send('language-changed', language)
    }
  })
}
