import fs from 'fs'
import path from 'path'
import { remote } from 'electron'
import fse from 'fs-extra'
import { SpellCheckHandler } from 'electron-spellchecker'
import fallbackLocales from 'electron-spellchecker/src/fallback-locales' // TODO(spell): Export these functions in our fork
import { normalizeLanguageCode } from 'electron-spellchecker/src/utility' // TODO(spell): ...

const isOSX = process.platform === 'darwin'
// NOTE: Hardcoded in "electron-spellchecker/src/dictionary-sync.js" but we could overwrite it
const dictionaryPath = path.join(remote.app.getPath('userData'), 'dictionaries')

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
 * Returns a list of all available Hunspell dictionaries.
 *
 * NOTE: Should return around 136 languages.
 */
export const getHunspellDictionaries = () => {
  return fallbackLocales.map(twoLetterCode => {
    return fallbackLocales[twoLetterCode]
  })
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
      // E.g: de-DE.bdic or en-US.bdic
      if (filename.length === 10 && filename.endsWith('.bdic') && fs.lstatSync(fullname).isFile()) {
        dict.push(filename.slice(0, 5))
      }
    })
  }
  return dict
}

// TODO(spell): Move to `utils.js` - there are may be better solutions to deep clone?!
/**
 * Clone a object as a shallow or deep copy.
 *
 * @param {*} obj Object to clone
 * @param {*} deepCopy Create a shallow or deep copy.
 */
const cloneObj = (obj, deepCopy = true) => {
  return deepCopy ? JSON.parse(JSON.stringify(obj)) : Object.assign({}, obj)
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
  // TODO(spell): Enable automaticallyIdentifyLanguages

  constructor (automaticallyIdentifyLanguages = false) {
    this.provider = new SpellCheckHandler()
    // this.provider.autoUnloadDictionariesOnBlur()

    // this.automaticallyIdentifyLanguages = automaticallyIdentifyLanguages
    this.lang = this.provider.currentSpellcheckerLanguage // default value should be "en-US"
    this.userDictionary = new UserDictionary()
    // Hunspell is used on Linux and Windows, macOS can use it.
    this.isHunspell = !isOSX || !!process.env['SPELLCHECKER_PREFER_HUNSPELL'] // eslint-disable-line dot-notation
    this.isEnabled = false

    console.log(`Using ${this.isHunspell ? 'Hunspell' : 'OS-level'} spellchecker.`) // #DEBUG
  }

  async init (lang = '') {
    // TODO(spell): Maybe we should ship Mark Text with a default "en-US" dictionary as fallback
    //              because we require a working internet connection to download dictionaries for Hunspell.
    //              On macOS the user need to download dictionaries via system settings.

    if (!lang) {
      if (this.isHunspell) {
        // TODO(spell): Downloading dictionaries require internet connection. Allow only downloaded dictionaries.
        // lang = process.env.LANG || remote.app.getLocale() || 'en-US'
        lang = 'en-US'
      } else {
        // NOTE: macOS does automatic language detection, we're gonna trust it - @electron-spellchecker
        lang = 'en-US'
      }
    }

    // We have to call our switch language method to ensure that the provider is in a valid state.
    const { result, lang: currentLang } = await this._switchLanguage(lang)
    if (!result) {
      throw new Error('SpellChecker: Error while initializing SpellChecker.')
    }

    // Spellchecker is attached to the window document.
    this.provider.attachToInput()
    this.isEnabled = true
    return currentLang
  }

  async addToDictionary (word) {
    // TODO(spell): We can add this directly to the system but how do we remove the word?
    // if (isOSX) {
    //   return await this.provider.addToDictionary(word)
    // }
    return this.userDictionary.addToDictionary(word)
  }

  removeFromDictionary (word) {
    return this.userDictionary.removeFromDictionary(word)
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

    if (isOSX && !this.isHunspell) {
      if (!this.provider.currentSpellchecker) return []
      // NB: OS X will return lists that are half just a language, half
      // language + locale, like ['en', 'pt_BR', 'ko']
      return this.provider.currentSpellchecker.getAvailableDictionaries()
        .map(x => {
          if (x.length === 2) return fallbackLocales[x]
          return normalizeLanguageCode(x)
        })
    }
    return getAvailableHunspellDictionaries()
  }

  /**
   * Try to load/download the specific language and attempts to use fallbacks if it fails.
   *
   * NOTE: This function can throw an exception.
   *
   * @param {*} lang Language code
   * @returns Dictionary/language tuple
   */
  async loadDictionary (lang) {
    // const { dictionary, language } =
    return await this.provider.loadDictionaryForLanguageWithAlternatives(lang)
  }

  enableSpellChecker () {
    // TODO(spell): ...
  }

  disableSpellChecker () {
    // TODO(spell): ...
  }

  /**
   * Explicitly switch the language to a specific language.
   *
   * NOTE: When using Hunspell, the dictionary will be downloaded if it doesn't exist.
   * NOTE: This function can throw an exception.
   *
   * @param {*} lang Language code
   * @returns
   */
  async switchLanguage (lang) {
    // TODO(spell): this.isDisabled --> enable spellchecker?
    if (this.isDisabled) {
      return false
    }
    return await this._switchLanguage(lang)
  }

  /**
   * UNSAFE - don't call directly! Explicitly switch the language to a specific language.
   *
   * This method should be only called from "switchLanguage()" and "init()".
   */
  async _switchLanguage (lang) {
    // NOTE: "provider" may be in an invalid state when "!result" (e.g. currentSpellchecker may be null)!
    let result = await this.provider.switchLanguage(lang)
    this.lang = this.provider.currentSpellcheckerLanguage

    // "switchLanguage" returns a boolean on macOS only.
    if (!isOSX) {
      result = !!this.provider.currentSpellchecker
    }

    console.log(`switchLanguage: ${result}; lang: ${lang}; actualLang: ${this.lang}`) // #DEBUG

    if (result) {
      this.userDictionary.loadDictionaryForLanguage(this.lang)
    } else {
      // TODO(spell): Disable spellchecker? We have to set the spellchecker in a valid state!
      //              At the moment undefined behavior :/
      // this.disableSpellChecker()
      this.userDictionary.unloadDictionary()
    }
    return { result, lang: result ? this.lang : '' }
  }

  /**
   * Is the given word misspelled.
   *
   * @param {*} word
   */
  isMisspelled (word) {
    return !this.userDictionary.match(word) && this.provider.isMisspelled(word)
  }

  /**
   * Extract the word at the given offset from the text.
   *
   * @param {*} text Text
   * @param {*} offset Normalized cursor offset (e.g. ab<cursor>c def --> 2)
   */
  extractWord (text, offset) {
    if (!text || text.length === 0) return null
    if (offset < 0) offset = 0
    if (offset >= text.length) offset = text.length - 1

    // Get nearest word
    // Based on: https://stackoverflow.com/a/5174867
    const pos = Number(offset) >>> 0

    // Search for the word's beginning and end.
    const left = text.slice(0, pos + 1).search(WORD_DEFINITION) // /\S+$/
    const right = text.slice(pos).search(WORD_SEPARATORS) // /\s/

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
      right: right + pos,
      word: text.slice(left, right + pos)
    }
  }

  /**
   * Get corrections.
   *
   * @param {*} word
   * @returns A array of words
   */
  async getWordSuggestion (word) {
    if (!this.isMisspelled(word)) {
      return []
    }
    return await this.provider.getCorrectionsForMisspelling(word)
  }

  get isDisabled () {
    // NOTE: If spellchecker is disabled and you call a method, the behavior is undefined.
    return !this.isEnabled
  }

  get getConfiguration () {
    const { isHunspell, lang } = this
    const automaticallyIdentifyLanguages = this.provider.automaticallyIdentifyLanguages
    return {
      automaticallyIdentifyLanguages,
      lang,
      isHunspell
    }
  }
}

// TODO(spell): Move to utils.js
const ensureDir = dirPath => {
  try {
    fse.ensureDirSync(dirPath)
  } catch (e) {
    if (e.code !== 'EEXIST') {
      // TODO(spell): log error
      console.error(e)
    }
  }
}

// TODO(spell): Fork "electron-spellchecker" and add custom user dictories. Otherwise are
//              word still red highlighted.
// Enable Add/Remove in "src/renderer/contextMenu/editor/index.js" to test the code below.

export class UserDictionary {
  // TODO(spell): Add a custom dictionary for user defined words using Radix tree/HAT-trie?

  constructor (dirPath = null) {
    this.dict = null
    this.lang = ''
    this.userDictPath = dirPath || dictionaryPath
    ensureDir(this.userDictPath)
  }

  isInitialized () {
    return this.lang && this.dict
  }

  unloadDictionary () {
    this.dict = null
    this.lang = ''
  }

  loadDictionaryForLanguage (lang) {
    const fullname = path.join(this.userDictPath, `${lang}.json`)
    if (fs.existsSync(fullname) && fs.lstatSync(fullname).isFile()) {
      try {
        const dict = JSON.parse(fs.readFileSync(fullname))
        this.dict = dict
      } catch (e) {
        // TODO(spell): log error
        console.error(e)
        return false
      }
    } else {
      this.dict = {}
    }
    this.lang = lang
    return true
  }

  saveDictionary () {
    if (!this.isInitialized()) {
      return false
    }

    try {
      const fullname = path.join(this.userDictPath, `${this.lang}.json`)
      fse.outputFileSync(fullname, JSON.stringify(this.dict), 'utf-8')
      return true
    } catch (e) {
      // TODO(spell): log error
      console.error(e)
      return false
    }
  }

  addToDictionary (word) {
    if (!this.isInitialized()) {
      return false
    }

    this.dict[word] = 1
    return this.saveDictionary()
  }

  removeFromDictionary (word) {
    if (!this.isInitialized()) {
      return false
    } else if (!this.match(word)) {
      return true
    }

    delete this.dict[word]
    return this.saveDictionary()
  }

  match (word) {
    return this.isInitialized() && !!this.dict.hasOwnProperty(word)
  }
}
