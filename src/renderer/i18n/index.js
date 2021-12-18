import i18n, { languageOptions, DEFAULT_LOCALE } from '../../locales'
import { ipcRenderer } from 'electron'

/**
 * Fetch language config value from preference storage.
 * @returns A promise carrying the language value.
 */
function asyncGetLanguage () {
  return new Promise((resolve) => {
    ipcRenderer.send('mt::ask-for-user-preference')

    ipcRenderer.on('mt::user-preference', (e, preferences) => {
      resolve(preferences.language)
    })
  })
}

export {
  languageOptions,
  asyncGetLanguage,
  DEFAULT_LOCALE
}

export default i18n
