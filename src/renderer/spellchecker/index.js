import fs from 'fs-extra'
import path from 'path'
import { remote } from 'electron'
import { SpellCheckHandler } from 'electron-spellchecker'
import fallbackLocales from 'electron-spellchecker/src/fallback-locales' // TODO(spell): Export these functions in our fork
import { normalizeLanguageCode } from 'electron-spellchecker/src/utility' // TODO(spell): ...
import { isOsx, cloneObj } from '../util'

// NOTE: Hardcoded in "electron-spellchecker/src/dictionary-sync.js"
export const dictionaryPath = path.join(remote.app.getPath('userData'), 'dictionaries')

// Source: https://github.com/Microsoft/vscode/blob/master/src/vs/editor/common/model/wordHelper.ts
// /(-?\d*\.\d\w*)|([^\`\~\!\@\#\$\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/
const WORD_SEPARATORS = /([`~!@#$%^&*()-=+[{\]}\\|;:'",.<>/?\s])/
const WORD_DEFINITION = /(-?\d*\.\d\w*)|([^`~!@#$%^&*()-=+[{\]}\\|;:'",.<>/?\s]+)$/

/**
 * Translate a left and right offset into a cursor.
 *
 * @param {*} lineCursor Original line cursor
 * @param {*} left Start offset/index
 * @param {*} right End offset/index
 */
export const offsetToWordCursor = (lineCursor, left, right) => {
  // Deep clone cursor start and end
  const start = cloneObj(lineCursor.start, true)
  const end = cloneObj(lineCursor.end, true)
  start.offset = left
  end.offset = right
  return { start, end }
}

export const validateLineCursor = cursor => {
  return cursor && cursor.start && cursor.start.hasOwnProperty('offset') &&
    cursor.end && cursor.end.hasOwnProperty('offset')
}

/**
 * Returns a list of local available Hunspell dictionaries.
 */
export const getAvailableHunspellDictionaries = () => {
  const dict = []
  // Return dictionaries from filesystem.
  if (fs.existsSync(dictionaryPath) && fs.lstatSync(dictionaryPath).isDirectory()) {
    fs.readdirSync(dictionaryPath).forEach(filename => {
      const fullname = path.join(dictionaryPath, filename)
      const match = filename.match(/^([a-z]{2}(?:[-][A-Z]{2})?)\.bdic$/)
      if (match && match[1] && fs.lstatSync(fullname).isFile()) {
        dict.push(match[1])
      }
    })
  }
  return dict
}

/**
 * High level spellchecker API for the current window.
 *
 * Language providers:
 *  - macOS: NSSpellChecker
 *  - else or hint*: Hunspell (bdict files)
 *  *: You have to set "SPELLCHECKER_PREFER_HUNSPELL" environment variable to 1 on macOS to use Hunspell.
 */
export class SpellChecker {
  constructor (automaticallyIdentifyLanguages = false, enabled = true) {
    // Hunspell is used on Linux and Windows but macOS can use Hunspell if prefered.
    this.isHunspell = !isOsx || !!process.env['SPELLCHECKER_PREFER_HUNSPELL'] // eslint-disable-line dot-notation

    // Initialize spell check provider. If spell check is not enabled don't
    // initialize the handler to not load the native module.
    if (enabled) {
      this._initHandler(automaticallyIdentifyLanguages)
    } else {
      this.provider = null
      this.lang = 'en-US'
      this.isEnabled = false
      this.isInitialized = false
    }

    console.log(`Using ${this.isHunspell ? 'Hunspell' : 'OS-level'} spellchecker. Enabled=${enabled}`) // #DEBUG
  }

  _initHandler (automaticallyIdentifyLanguages) {
    this.provider = new SpellCheckHandler()

    // // TODO(spell): Currently not supported by our Hunspell implementation
    // //              with a reasonable performance.
    // if (this.isHunspell) {
    //   automaticallyIdentifyLanguages = false
    // }

    this.provider.automaticallyIdentifyLanguages = automaticallyIdentifyLanguages

    // React to changes such as language detection.
    this.provider.currentSpellcheckerChanged.subscribe(() => {
      console.log(
        '# currentSpellcheckerChanged',
        '\nEnabled:', this.isEnabled,
        '\nAutoIdentifyLanguages:', this.provider.automaticallyIdentifyLanguages,
        '\nLanguage:', this.provider.currentSpellcheckerLanguage,
        '\nisHunspell:', this.provider.isHunspell
      ) // #DEBUG

      // TODO(spell): Something changed...
    })

    this.lang = this.provider.currentSpellcheckerLanguage // default value should be "en-US"

    // The spell checker is now initialized but not yet enabled. Please call `init`.
    this.isEnabled = false
    this.isInitialized = true
  }

  async init (lang = '', isPassiveMode = false) {
    if (this.isEnabled) {
      return
    } else if (!this.isInitialized) {
      this._initHandler(false, false)
    }

    if (!lang) {
      if (this.isHunspell) {
        // Just use the fallback language.
        lang = 'en-US'
      } else {
        // NOTE: macOS does automatic language detection if language is empty.
        lang = ''
        this.provider._automaticallyIdentifyLanguages = true
      }
    }

    // We have to call our switch language method to ensure that the provider is in a valid state.
    const currentLang = await this._switchLanguage(lang)
    if (!currentLang) {
      throw new Error('SpellChecker: Error while initializing SpellChecker.')
    }

    // If true, don't highlight misspelled words.
    this.provider.isPassiveMode = isPassiveMode

    // Attach the spell checker to the window document.
    this.provider.attachToInput()
    this.isEnabled = true
    return currentLang
  }

  /**
   * Enable spell checker.
   */
  async enableSpellchecker (lang = '') {
    if (this.isEnabled) {
      return true
    }

    const result = await this.provider.enableSpellchecker(lang)
    if (!result) {
      return false
    }

    this.lang = this.provider.currentSpellcheckerLanguage
    this.isEnabled = true
    return true
  }

  /**
   * Disable spell checker.
   */
  disableSpellchecker () {
    if (!this.isEnabled) {
      return true
    }

    this.provider.disableSpellchecker()
    this.isEnabled = false
  }

  async addToDictionary (word) {
    return await this.provider.addToDictionary(word)
  }

  async removeFromDictionary (word) {
    return await this.provider.removeFromDictionary(word)
  }

  /**
   * Returns a list of available dictionaries.
   */
  getAvailableDictionaries () {
    // NOTE: On macOS we only receive the dictionaries when the spellchecker is active!
    // Therefore be consistent.
    if (!this.provider.currentSpellchecker) {
      return []
    }

    if (isOsx && !this.isHunspell) {
      if (!this.provider.currentSpellchecker) return []
      // NB: OS X will return lists that are half just a language, half
      // language + locale, like ['en', 'pt_BR', 'ko']
      return this.provider.currentSpellchecker.getAvailableDictionaries()
        .map(x => {
          if (x.length === 2) return fallbackLocales[x]
          try {
            return normalizeLanguageCode(x)
          } catch (_) {
            return null
          }
        })
    }

    // TODO(spell): Use cache and update these regularly or via events.
    return getAvailableHunspellDictionaries()
  }

  /**
   * Try to load the specific language and attempts to use fallbacks if it fails.
   *
   * NOTE: This function can throw an exception.
   *
   * @param {string} lang Language code
   * @returns {Object.<string, Buffer>} Dictionary/language tuple
   */
  async loadDictionary (lang) {
    // const { dictionary, language } =
    return await this.provider.loadDictionaryForLanguageWithAlternatives(lang)
  }

  /**
   * Is the spellchecker trying to detect the typed language automatically?
   */
  get automaticallyIdentifyLanguages () {
    if (!this.isEnabled) {
      return false
    }
    return this.provider.automaticallyIdentifyLanguages
  }

  /**
   * Is the spellchecker trying to detect the typed language automatically?
   */
  set automaticallyIdentifyLanguages (value) {
    // TODO(spell): Allow to change state when disabled.
    if (!this.isEnabled) {
      return
    }

    // // TODO(spell): Currently not supported by our Hunspell implementation
    // //              with a reasonable performance.
    // if (this.isHunspell) {
    //   return
    // }
    this.provider.automaticallyIdentifyLanguages = !!value
  }

  /**
   * Returns true if not misspelled words should be highlighted.
   */
  get spellcheckerNoUnderline () {
    if (!this.isEnabled) {
      return false
    }
    return this.provider.spellcheckerNoUnderline
  }

  /**
   * Should we highlight misspelled words.
   */
  set spellcheckerNoUnderline (value) {
    // TODO(spell): Allow to change state when disabled.
    if (!this.isEnabled) {
      return
    }
    this.provider.spellcheckerNoUnderline = !!value
  }

  /**
   * Explicitly switch the language to a specific language.
   *
   * NOTE: This function can throw an exception.
   *
   * @param {string} lang Language code
   * @returns {string|null} Return the language on success.
   */
  async switchLanguage (lang) {
    // TODO(spell): Is disabled --> enable spellchecker?
    if (!this.isEnabled) {
      throw new Error('Invalid state.')
    }
    return await this._switchLanguage(lang)
  }

  /**
   * UNSAFE - don't call directly! Explicitly switch the language to a specific language.
   *
   * This method should be only called from "switchLanguage()" and "init()".
   *
   * @param {string} lang Language code
   * @returns {string|null} Return the language on success.
   */
  async _switchLanguage (lang) {
    // NOTE: "provider" may be in an invalid state when "!result" (e.g. currentSpellchecker may be null)!
    const result = await this.provider.switchLanguage(lang)
    if (!result) {
      // TODO(spell): Should we disable spell checking on error?
      // this.disableSpellchecker()

      throw new Error('Error while switching language.')
    }

    this.lang = this.provider.currentSpellcheckerLanguage

    console.log(`switchLanguage: ${!!result}; lang: ${lang}; actualLang: ${this.lang}`) // #DEBUG

    return this.lang
  }

  /**
   * Is the given word misspelled.
   *
   * @param {string} word
   */
  isMisspelled (word) {
    if (!this.isEnabled) {
      return false
    }
    return this.provider.isMisspelled(word)
  }

  /**
   * Extract the word at the given offset from the text.
   *
   * @param {string} text Text
   * @param {number} offset Normalized cursor offset (e.g. ab<cursor>c def --> 2)
   */
  extractWord (text, offset) {
    if (!text || text.length === 0) {
      return null
    } else if (offset < 0) {
      offset = 0
    } else if (offset >= text.length) {
      offset = text.length - 1
    }

    // Search for the words beginning and end.
    const left = text.slice(0, offset + 1).search(WORD_DEFINITION)
    const right = text.slice(offset).search(WORD_SEPARATORS)

    // Cursor is between two word separators (e.g "*<cursor>*" or " <cursor>*")
    if (left <= -1) {
      return null
    }

    // The last word in the string is a special case.
    if (right < 0) {
      return {
        left,
        right: text.length,
        word: text.slice(left)
      }
    }
    return {
      left,
      right: right + offset,
      word: text.slice(left, right + offset)
    }
  }

  /**
   * Get corrections.
   *
   * @param {string} word
   * @returns A array of words
   */
  async getWordSuggestion (word) {
    if (!this.isMisspelled(word)) {
      return []
    }
    return await this.provider.getCorrectionsForMisspelling(word)
  }

  get getConfiguration () {
    const { isEnabled, isHunspell, lang } = this
    const automaticallyIdentifyLanguages = this.automaticallyIdentifyLanguages

    const spellcheckerLanguage = isEnabled ? this.provider.currentSpellcheckerLanguage : '?' // #DEBUG

    return {
      isEnabled,
      automaticallyIdentifyLanguages,
      lang,
      spellcheckerLanguage,
      isHunspell
    }
  }
}
