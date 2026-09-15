import { isOsx } from '@/util'

/**
 * High level spell checker API based on Chromium built-in spell checker.
 */
export class SpellChecker {
  enabled: boolean
  currentSpellcheckerLanguages: string[]
  isProviderAvailable: boolean

  constructor(enabled = true, languages: string[] = []) {
    this.enabled = enabled
    this.currentSpellcheckerLanguages = languages

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
   * Enable the spell checker and set the configured languages.
   */
  async activateSpellchecker(languages?: string[]): Promise<boolean> {
    try {
      this.enabled = true
      this.isProviderAvailable = true
      if (isOsx) {
        // No language string needed on macOS.
        await window.electron.ipcRenderer.invoke('mt::spellchecker-set-enabled', true)
        return true
      }
      return await this.setLanguages(languages ?? this.currentSpellcheckerLanguages)
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
   * Return the current languages.
   */
  get languages(): string[] {
    if (this.isEnabled) {
      return this.currentSpellcheckerLanguages
    }
    return []
  }

  set languages(languages: string[]) {
    this.currentSpellcheckerLanguages = languages
  }

  /**
   * Set the languages used by the spell checker.
   *
   * NOTE: This function can throw an exception.
   */
  async setLanguages(languages: string[]): Promise<boolean> {
    if (isOsx) {
      // NB: macOS uses the OS spell checker and detects language automatically.
      return true
    } else if (languages.length === 0) {
      throw new Error('Expected at least one language for spell checker.')
    } else if (this.isEnabled) {
      await window.electron.ipcRenderer.invoke('mt::spellchecker-switch-language', languages)
      this.languages = languages
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
