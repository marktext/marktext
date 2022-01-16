import { ipcRenderer } from 'electron'
import { isOsx } from '@/util'

/**
 * High level spell checker API based on Chromium built-in spell checker.
 */
export class SpellChecker {
  /**
   * ctor
   *
   * @param {boolean} enabled Whether spell checking is enabled in settings.
   */
  constructor (enabled = true, lang) {
    this.enabled = enabled
    this.currentSpellcheckerLanguage = lang

    // Helper to forbid the usage of the spell checker (e.g. failed to create native spell checker),
    // even if spell checker is enabled in settings.
    this.isProviderAvailable = true
  }

  /**
   * Whether the spell checker is available and enabled.
   */
  get isEnabled () {
    return this.isProviderAvailable && this.enabled
  }

  /**
   * Enable the spell checker and sets `lang` or tries to find a fallback.
   *
   * @param {string} lang The language to set.
   * @returns {Promise<boolean>}
   */
  async activateSpellchecker (lang) {
    try {
      this.enabled = true
      this.isProviderAvailable = true
      return await this.switchLanguage(lang || this.currentSpellcheckerLanguage)
    } catch (error) {
      this.deactivateSpellchecker()
      throw error
    }
  }

  /**
   * Disables the native spell checker.
   */
  deactivateSpellchecker () {
    this.enabled = false
    this.isProviderAvailable = false
    ipcRenderer.send('mt::spellchecker-set-enabled', false)
  }

  // /**
  //  * Add a word to the user dictionary.
  //  *
  //  * @param {string} word The word to add.
  //  * @returns {Promise<boolean>} Whether the word was added.
  //  *
  //  */
  // async addToDictionary (word) {
  //   if (!this.isEnabled) {
  //     return false
  //   }
  //   return ipcRenderer.invoke('mt::spellchecker-add-word', word)
  // }
  //
  // /**
  //  * Remove a word from the user dictionary.
  //  *
  //  * @param {string} word The word to remove.
  //  * @returns {Promise<boolean>} Whether the word was removed.
  //  */
  // async removeFromDictionary (word) {
  //   if (!this.isEnabled) {
  //     return false
  //   }
  //   return ipcRenderer.invoke('mt::spellchecker-remove-word', word)
  // }

  /**
   * Return the current language.
   */
  get lang () {
    if (this.isEnabled) {
      return this.currentSpellcheckerLanguage
    }
    return ''
  }

  set lang (lang) {
    this.currentSpellcheckerLanguage = lang
  }

  /**
   * Explicitly switch the language to a specific language.
   *
   * NOTE: This function can throw an exception.
   *
   * @param {string} lang The language code
   * @returns {Promise<boolean>} Return the language on success or null.
   */
  async switchLanguage (lang) {
    if (isOsx) {
      // NB: On macOS the OS spell checker is used and will detect the language automatically.
      return true
    } else if (!lang) {
      throw new Error('Invalid empty language.')
    } else if (this.isEnabled) {
      const errorMsg = await ipcRenderer.invoke('mt::spellchecker-switch-language', lang)
      if (errorMsg) {
        throw new Error(errorMsg)
      }
      this.lang = lang
      return true
    }
    return false
  }

  // /**
  //  * Is the given word misspelled.
  //  *
  //  * @param {string} word The word to check.
  //  */
  // isMisspelled (word) {
  //   // NOTE: Move to main because `webFrame.getWordSuggestions` and `webFrame.isWordMisspelled`
  //   //       doesn't work on Windows (Electron#28684).
  //   if (this.isEnabled) {
  //     return webFrame.isWordMisspelled(word)
  //   }
  //   return false
  // }
  //
  // /**
  //  * Get corrections.
  //  *
  //  * @param {string} word The word to get suggestion for.
  //  * @returns {Promise<string[]>} An array of suggestions.
  //  */
  // async getWordSuggestion (word) {
  //   // NOTE: Move to main because `webFrame.getWordSuggestions` and `webFrame.isWordMisspelled`
  //   //       doesn't work on Windows (Electron#28684).
  //   if (this.isEnabled) {
  //     return webFrame.getWordSuggestions(word)
  //   }
  //   return []
  // }

  /**
   * Returns a list of available dictionaries.
   * @returns {Promise<string[]>} Available dictionary languages.
   */
  static async getAvailableDictionaries () {
    if (isOsx) {
      // NB: On macOS the OS spell checker is used and will detect the language automatically.
      return []
    }
    return ipcRenderer.invoke('mt::spellchecker-get-available-dictionaries')
  }
}
