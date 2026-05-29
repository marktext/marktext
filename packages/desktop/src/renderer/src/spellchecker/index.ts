import { isOsx } from '@/util'

/**
 * High level spell checker API based on Chromium built-in spell checker.
 */
export class SpellChecker {
  enabled: boolean
  currentSpellcheckerLanguage: string
  isProviderAvailable: boolean

  constructor(enabled = true, lang = '') {
    this.enabled = enabled
    this.currentSpellcheckerLanguage = lang

    // Helper to forbid the usage of the spell checker (e.g. failed to create
    // native spell checker), even if spell checker is enabled in settings.
    this.isProviderAvailable = true
  }

  /**
   * Whether the spell checker is available and enabled.
   */
  get isEnabled(): boolean {
    return this.isProviderAvailable && this.enabled
  }

  /**
   * Enable the spell checker and sets `lang` or tries to find a fallback.
   */
  async activateSpellchecker(lang?: string): Promise<boolean> {
    try {
      this.enabled = true
      this.isProviderAvailable = true
      if (isOsx) {
        // No language string needed on macOS.
        await window.electron.ipcRenderer.invoke('mt::spellchecker-set-enabled', true)
        return true
      }
      return await this.switchLanguage(lang || this.currentSpellcheckerLanguage)
    } catch (error) {
      this.deactivateSpellchecker()
      throw error
    }
  }

  /**
   * Disables the native spell checker.
   */
  deactivateSpellchecker(): void {
    this.enabled = false
    this.isProviderAvailable = false
    window.electron.ipcRenderer.invoke('mt::spellchecker-set-enabled', false)
  }

  /**
   * Return the current language.
   */
  get lang(): string {
    if (this.isEnabled) {
      return this.currentSpellcheckerLanguage
    }
    return ''
  }

  set lang(lang: string) {
    this.currentSpellcheckerLanguage = lang
  }

  /**
   * Explicitly switch the language to a specific language.
   *
   * NOTE: This function can throw an exception.
   */
  async switchLanguage(lang: string): Promise<boolean> {
    if (isOsx) {
      // NB: macOS uses the OS spell checker and detects language automatically.
      return true
    } else if (!lang) {
      throw new Error('Expected non-empty language for spell checker.')
    } else if (this.isEnabled) {
      await window.electron.ipcRenderer.invoke('mt::spellchecker-switch-language', lang)
      this.lang = lang
      return true
    }
    return false
  }

  /**
   * Returns a list of available dictionaries.
   */
  static async getAvailableDictionaries(): Promise<string[]> {
    if (isOsx) {
      // NB: macOS uses the OS spell checker and detects language automatically.
      return []
    }
    return window.electron.ipcRenderer.invoke('mt::spellchecker-get-available-dictionaries')
  }
}
