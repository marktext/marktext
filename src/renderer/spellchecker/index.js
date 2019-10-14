import fs from 'fs-extra'
import path from 'path'
import { remote } from 'electron'
import { SpellCheckHandler, fallbackLocales, normalizeLanguageCode } from '@hfelix/electron-spellchecker'
import { isOsx, cloneObj } from '../util'

// NOTE: Hardcoded in "@hfelix/electron-spellchecker/src/spell-check-handler.js"
export const dictionaryPath = path.join(remote.app.getPath('userData'), 'dictionaries')

// Source: https://github.com/Microsoft/vscode/blob/master/src/vs/editor/common/model/wordHelper.ts
// /(-?\d*\.\d\w*)|([^\`\~\!\@\#\$\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/
const WORD_SEPARATORS = /([`~!@#$%^&*()-=+[{\]}\\|;:'",.<>/?\s])/
const WORD_DEFINITION = /(-?\d*\.\d\w*)|([^`~!@#$%^&*()-=+[{\]}\\|;:'",.<>/?\s]+)$/

/**
 * Translate a left and right offset from a word in `line` into a cursor with
 * the given line cursor.
 *
 * @param {*} lineCursor The original line cursor.
 * @param {number} left Start offset/index of word in `lineCursor`.
 * @param {number} right End offset/index of word in `lineCursor`.
 * @returns {*} Return a cursor of the word selected in `lineCursor`(e.g.
 *              "foo >bar< foo" where `>`/`<` start and end offset).
 */
export const offsetToWordCursor = (lineCursor, left, right) => {
  // Deep clone cursor start and end
  const start = cloneObj(lineCursor.start, true)
  const end = cloneObj(lineCursor.end, true)
  start.offset = left
  end.offset = right
  return { start, end }
}

/**
 * Validate whether the selection is valid for spelling correction.
 *
 * @param {*} selection The preview editor selection range.
 */
export const validateLineCursor = selection => {
  // Validate selection range.
  if (!selection && !selection.start && !selection.start.hasOwnProperty('offset') &&
    !selection.end && !selection.end.hasOwnProperty('offset')) {
    return false
  }

  // Allow only single lines
  const { start: startCursor, end: endCursor } = selection
  if (startCursor.key !== endCursor.key || !startCursor.block) {
    return false
  }

  // Don't correct words in code blocks or editors for HTML, LaTex and diagrams.
  if (startCursor.block.functionType === 'codeContent' &&
    startCursor.block.lang !== undefined) {
    return false
  }

  // Don't correct words in code blocks or pre elements such as language identifier.
  if (selection.affiliation && selection.affiliation.length === 1 &&
    selection.affiliation[0].type === 'pre') {
    return false
  }
  return true
}

/**
 * Returns a list of local available Hunspell dictionaries.
 *
 * @returns {string[]} List of available Hunspell dictionary language codes.
 */
export const getAvailableHunspellDictionaries = () => {
  const dict = []
  // Search for dictionaries on filesystem.
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
 * High level spell checker API.
 *
 * Language providers:
 *  - macOS: NSSpellChecker (default) or Hunspell
 *  - Linux and Windows: Hunspell
 */
export class SpellChecker {
  /**
   * ctor
   *
   * @param {boolean} enabled Whether spell checking is enabled.
   */
  constructor (enabled = true) {
    // Hunspell is used on Linux and Windows but macOS can use Hunspell if prefered.
    this.isHunspell = !isOsx || !!process.env['SPELLCHECKER_PREFER_HUNSPELL'] // eslint-disable-line dot-notation

    // Initialize spell check provider. If spell check is not enabled don't
    // initialize the handler to not load the native module.
    if (enabled) {
      this._initHandler()
    } else {
      this.provider = null
      this.fallbackLang = null
      this.isEnabled = false
      this.isInitialized = false
    }
  }

  _initHandler () {
    if (this.isInitialized) {
      throw new Error('Invalid state.')
    }

    this.provider = new SpellCheckHandler()

    // The spell checker is now initialized but not yet enabled. You need to call `init`.
    this.isEnabled = false
    this.isInitialized = true
  }

  /**
   * Initialize the spell checker and attach it to the window.
   *
   * @param {string} lang 4-letter language ISO-code.
   * @param {boolean} automaticallyIdentifyLanguages Whether we should try to identify the typed language.
   * @param {boolean} isPassiveMode Should we highlight misspelled words?
   * @param {[HTMLElement]} container The optional container to attach the automatic spell detection when
   *                                  using Hunspell. Default `document.body`.
   * @returns {string} Returns current spell checker language.
   */
  async init (lang = '', automaticallyIdentifyLanguages = false, isPassiveMode = false, container = null) {
    if (this.isEnabled) {
      return
    } else if (!this.isInitialized) {
      this._initHandler()
    }

    if (!lang && !automaticallyIdentifyLanguages) {
      throw new Error('Init: Either language or automatic language detection must be set.')
    }

    // TODO(spell): Currently not supported by our Hunspell implementation
    //              with a reasonable performance and Node worker threads
    //              doesn't work currently in Electron (Electon#18540).
    if (this.isHunspell) {
      automaticallyIdentifyLanguages = false
    }

    // This just set a variable when using Hunspell and switch the spell checker mode
    // when using macOS spell checker. Calling switchLanguage after this using macOS
    // spell checker will deactivate automatic language detection.
    this.provider.automaticallyIdentifyLanguages =
      automaticallyIdentifyLanguages || (!this.isHunspell && !lang)

    // If true, don't highlight misspelled words. Just like above, this method only
    // affect the macOS spell checker.
    this.provider.isPassiveMode = isPassiveMode

    if (!this.isHunspell && (automaticallyIdentifyLanguages || !lang)) {
      // Attach the spell checker to the our editor.
      // NOTE: Calling this method is normally not necessary on macOS with
      // OS spell checker.
      this.provider.attachToInput(container)

      this.fallbackLang = null
      this.isEnabled = true
      return this.lang
    }

    if (!lang) {
      // Set to Hunspell fallback language
      lang = 'en-US'
    }

    // We have to call our switch language method to ensure that the provider is in a valid state.
    const currentLang = await this._switchLanguage(lang)
    if (!currentLang) {
      throw new Error(`Language "${lang}" is not available.`)
    }

    // Attach the spell checker to the our editor.
    this.provider.attachToInput(container)
    this.fallbackLang = currentLang
    this.isEnabled = true
    return currentLang
  }

  /**
   * Enable spell checker.
   *
   * NOTE: Using `undefined` will use the existing values.
   * NOTE: When spell checker is already enabled this method has no effect.
   *
   * @param {[string]} lang 4-letter language ISO-code.
   * @param {[boolean]} automaticallyIdentifyLanguages Whether we should try to identify the typed language.
   * @param {[boolean]} isPassiveMode Should we highlight misspelled words?
   */
  async enableSpellchecker (lang = undefined, automaticallyIdentifyLanguages = undefined, isPassiveMode = undefined) {
    if (this.isEnabled) {
      return true
    }

    const result = await this.provider.enableSpellchecker(
      lang,
      automaticallyIdentifyLanguages,
      isPassiveMode
    )
    if (!result) {
      // Spell checker may be in an invalid state and don't try to recover.
      this.disableSpellchecker()
      return false
    }

    this.fallbackLang = this.lang
    this.isEnabled = true
    return true
  }

  /**
   * Disable spell checker.
   */
  disableSpellchecker () {
    if (!this.isEnabled) {
      return
    }

    this.provider.disableSpellchecker()
    this.isEnabled = false
  }

  /**
   * Add a word to the user dictionary.
   *
   * @param {string} word The word to add.
   */
  async addToDictionary (word) {
    return await this.provider.addToDictionary(word)
  }

  /**
   * Remove a word frome the user dictionary.
   *
   * @param {string} word The word to remove.
   */
  async removeFromDictionary (word) {
    return await this.provider.removeFromDictionary(word)
  }

  /**
   * Ignore a word for the current runtime.
   *
   * @param {string} word The word to ignore.
   */
  ignoreWord (word) {
    this.provider.ignoreWord(word)
  }

  /**
   * Returns a list of available dictionaries.
   * @returns {string[]} Available dictionary languages.
   */
  getAvailableDictionaries () {
    // NOTE: We only receive the dictionaries when the spellchecker is active
    // on macOS! Therefore be consistent.
    if (!this.provider.currentSpellchecker) {
      return []
    }

    if (!this.isHunspell) {
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

    // Load hunspell dictionaries from disk.
    return getAvailableHunspellDictionaries()
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
    if (!this.isEnabled) {
      return
    }

    // TODO(spell): Currently not supported by our Hunspell implementation
    //              with a reasonable performance and Node worker threads
    //              doesn't work currently in Electron (Electon#18540).
    if (this.isHunspell) {
      value = false
    }
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
    if (!this.isEnabled) {
      return
    }
    this.provider.spellcheckerNoUnderline = !!value
  }

  /**
   * Return the current language.
   */
  get lang () {
    if (!this.provider) {
      return ''
    }
    return this.provider.currentSpellcheckerLanguage
  }

  /**
   * Whether the spell checker is in an invalid state and therefore deactivated.
   */
  get isInvalidState () {
    if (!this.provider) {
      return false
    }
    return this.provider.invalidState
  }

  /**
   * Explicitly switch the language to a specific language.
   *
   * NOTE: This function can throw an exception.
   *
   * @param {string} lang The language code
   * @returns {string|null} Return the language on success or null.
   */
  async switchLanguage (lang) {
    if (!this.isEnabled) {
      throw new Error('Invalid state: spell checker is disabled.')
    } else if (!lang) {
      throw new Error('Invalid language.')
    }

    const currentLang = await this._switchLanguage(lang)
    if (currentLang) {
      this.fallbackLang = currentLang
    }
    return currentLang
  }

  /**
   * Is the given word misspelled.
   *
   * @param {string} word The word to check.
   */
  isMisspelled (word) {
    if (!this.isEnabled) {
      return false
    }
    return this.provider.isMisspelled(word)
  }

  /**
   * Get corrections.
   *
   * @param {string} word The word to get suggestion for.
   * @returns {string[]} A array of suggestions.
   */
  async getWordSuggestion (word) {
    if (!this.isMisspelled(word)) {
      return []
    }
    return await this.provider.getCorrectionsForMisspelling(word)
  }

  /**
   * Extract the word at the given offset from the text.
   *
   * @param {string} text Text
   * @param {number} offset Normalized cursor offset (e.g. ab<cursor>c def --> 2)
   */
  static extractWord (text, offset) {
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
   * @private
   * @param {string} lang The language code
   * @returns {string|null} Return the language on success or null.
   */
  async _switchLanguage (lang) {
    const result = await this.provider.switchLanguage(lang)
    if (!result) {
      return await this._tryRecover()
    }
    return this.lang
  }

  /**
   * Try to recover the spell checker's invalid state.
   *
   * @returns {string|null} Return the language on success or null.
   */
  async _tryRecover () {
    const lang = this.fallbackLang
    if (lang) {
      // Prevent rekursiv loop.
      this.fallbackLang = null

      // Try fallback language.
      const result = await this._switchLanguage(lang)
      if (result) {
        this.fallbackLang = lang
        return lang
      }

      // Spell checker is deactivated from rekursiv call.
      return null
    }

    // Spell checker is in an invalid state. We can recover it by enabling
    // with a valid language.
    this.disableSpellchecker()
    return null
  }
}
