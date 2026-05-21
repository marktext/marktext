import { ipcMain } from 'electron'
import { loadTranslations, getSupportedLanguages, isLanguageSupported } from 'common/i18n'

export const registerI18nHandlers = () => {
  ipcMain.handle('mt::i18n::load', (_e, language) => loadTranslations(language))
  ipcMain.handle('mt::i18n::supported', () => getSupportedLanguages())
  ipcMain.handle('mt::i18n::is-supported', (_e, language) => isLanguageSupported(language))
}
