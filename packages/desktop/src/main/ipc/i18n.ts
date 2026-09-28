import { ipcMain } from 'electron'
import {
  loadTranslations,
  getSupportedLanguages,
  isLanguageSupported,
  getLanguageCatalogEntries
} from 'common/i18n'

export const registerI18nHandlers = (): void => {
  ipcMain.handle('mt::i18n::load', (_e, language: string) => loadTranslations(language))
  ipcMain.handle('mt::i18n::supported', () => getSupportedLanguages())
  ipcMain.handle('mt::i18n::is-supported', (_e, language: string) => isLanguageSupported(language))
  ipcMain.handle('mt::i18n::catalog', () => getLanguageCatalogEntries())
}
