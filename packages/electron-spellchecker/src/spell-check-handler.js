const path = require('path');
const fs = require('fs-extra');
const EventEmitter = require('events');
const LRU = require('lru-cache');
const pThrottle = require('p-throttle');

const DictionarySync = require('./dictionary-sync');
const UserDictionary = require('./user-dictionary');
const {normalizeLanguageCode} = require('./utility');

let Spellchecker;

let d = require('debug')('electron-spellchecker:spell-check-handler');

// TODO(spell): Asynchronously check language via Web Workers?
const cld = require('./cld2'); // requireTaskPool(require.resolve('./cld2'));

let fallbackLocaleTable = null;
const app = process.type === 'renderer' ?
  require('electron').remote.app :
  require('electron').app;
let webFrame = (process.type === 'renderer' ?
  require('electron').webFrame :
  null);

// NB: Linux and Windows uses underscore in languages (i.e. 'en_US'), whereas
// we're trying really hard to match the Chromium way of `en-US`
const validLangCodeWindowsLinux = /[a-z]{2}[_][A-Z]{2}/;

const isMac = process.platform === 'darwin';
const isWindows = process.platform === 'win32';

// NB: This is to work around electron/electron#1005, where contractions
// are incorrectly marked as spelling errors. This lets people get away with
// incorrectly spelled contracted words, but it's the best we can do for now.
const contractions = [
  "ain't", "aren't", "can't", "could've", "couldn't", "couldn't've", "didn't", "doesn't", "don't", "hadn't",
  "hadn't've", "hasn't", "haven't", "he'd", "he'd've", "he'll", "he's", "how'd", "how'll", "how's", "I'd",
  "I'd've", "I'll", "I'm", "I've", "isn't", "it'd", "it'd've", "it'll", "it's", "let's", "ma'am", "mightn't",
  "mightn't've", "might've", "mustn't", "must've", "needn't", "not've", "o'clock", "shan't", "she'd", "she'd've",
  "she'll", "she's", "should've", "shouldn't", "shouldn't've", "that'll", "that's", "there'd", "there'd've",
  "there're", "there's", "they'd", "they'd've", "they'll", "they're", "they've", "wasn't", "we'd", "we'd've",
  "we'll", "we're", "we've", "weren't", "what'll", "what're", "what's", "what've", "when's", "where'd",
  "where's", "where've", "who'd", "who'll", "who're", "who's", "who've", "why'll", "why're", "why's", "won't",
  "would've", "wouldn't", "wouldn't've", "y'all", "y'all'd've", "you'd", "you'd've", "you'll", "you're", "you've"
];

const contractionMap = contractions.reduce((acc, word) => {
  acc[word.replace(/'.*/, '')] = true;
  return acc;
}, {});

const alternatesTable = {};

function ensureDir(dirPath) {
  try {
    fs.ensureDirSync(dirPath);
  } catch (e) {
    if (e.code !== 'EEXIST') {
      d(`Failed to create directory "${dirPath}": ${e.message}`);
    }
  }
}

/**
 * SpellCheckHandler is the main class of this library, and handles all of the
 * different pieces of spell checking except for the context menu information.
 *
 * Instantiate the class, then call {{attachToInput}} to wire it up. The spell
 * checker will attempt to automatically check the language that the user is
 * typing in and switch on-the fly. However, giving it an explicit hint by
 * calling {{switchLanguage}}, or providing it a block of sample text via
 * {{provideHintText}} will result in much better results.
 *
 * Sample text should be text that is reasonably likely to be in the same language
 * as the user typing - for example, in an Email reply box, the original Email text
 * would be a great sample, or in the case of Slack, the existing channel messages
 * are used as the sample text.
 */
module.exports = class SpellCheckHandler {
  /**
   * Constructs a SpellCheckHandler
   *
   * @param  {String}  cacheDir    The path to a directory to store dictionaries.
   *                               If not given, the Electron user data directory
   *                               will be used.
   */
  constructor(cacheDir=null) {
    // NB: Require here so that consumers can handle native module exceptions.
    Spellchecker = require('./node-spellchecker').Spellchecker;

    cacheDir = cacheDir || path.join(app.getPath('userData'), 'dictionaries');
    ensureDir(cacheDir);

    // TODO(spell): Ask spellchecker which spell checker is used and allow to change
    // at runtime.
    this.isHunspell = !isMac || !!process.env['SPELLCHECKER_PREFER_HUNSPELL'];
    this.dictionarySync = new DictionarySync(this.isHunspell, cacheDir);
    this.userDictionary = new UserDictionary(cacheDir);
    // Dictionary of ignored words for the current runtime.
    this.memoryDictionary = new UserDictionary(cacheDir, true);
    this.currentSpellchecker = null;
    this.currentSpellcheckerLanguage = null;
    this.isMisspelledCache = new LRU({ max: 5000 });
    this.isEnabled = false;
    // Spell checker is deactivated due to an issue (e.g. dict not available).
    this.invalidState = false;

    this.bus = new EventEmitter();
    this._unsubscribeFn = null;

    this._automaticallyIdentifyLanguages = !this.isHunspell;
    // Don't underline spelling mistakes.
    this._isPassiveMode = false;

    // Initialize in-memory dictionary.
    this.memoryDictionary.loadForLanguage();

    if (!this.isHunspell) {
      // NB: OS X does automatic language detection, we're gonna trust it
      this.currentSpellchecker = new Spellchecker();
      this.currentSpellcheckerLanguage = 'en-US';
      this.isEnabled = true;

      if (webFrame) {
        this.setSpellCheckProvider(webFrame);
      }
      return;
    }
  }

  /**
   * Is the spellchecker trying to detect the typed language automatically?
   */
  get automaticallyIdentifyLanguages() {
    return this._automaticallyIdentifyLanguages;
  }

  /**
   * Is the spellchecker trying to detect the typed language automatically?
   */
  set automaticallyIdentifyLanguages(value) {
    this._automaticallyIdentifyLanguages = !!value;
    this.bus.emit('resetAutoDetection');

    // Calling `setDictionary` on the macOS implementation of `@nornagon/spellchecker`
    // is the only way to set the `automaticallyIdentifyLanguages` property on the
    // native NSSpellchecker. Calling switchLanguage with a language will set it `false`,
    // while calling it with an empty language will set it to `true`
    if (!this.isHunspell && !!value) {
      this.switchLanguage();
    } else if (!this.isHunspell && !value && this.currentSpellcheckerLanguage) {
      this.switchLanguage(this.currentSpellcheckerLanguage);
    }
  }

  /**
   * Returns true if not misspelled words should be highlighted.
   *
   * NOTE: You should disable spellcheck attribute.
   */
  get isPassiveMode() {
    return this._isPassiveMode;
  }

  /**
   * Should we highlight misspelled words.
   */
  set isPassiveMode(value) {
    this._isPassiveMode = !!value;

    // We need to enable CLD because macOS spell checker cannot longer
    // auto detect the language.
    if (!this.isHunspell) {
      if (!!value) {
        // Enable CLD on document
        this.attachToInput();
      } else {
        // Disable CLD
        this.unsubscribe();
      }
    }
  }

  /**
   * Disconnect the events that we connected in {{attachToInput}} or other places
   * in the class.
   */
  unsubscribe() {
    this.bus.removeAllListeners();
    if (this._unsubscribeFn) {
      this._unsubscribeFn();
      this._unsubscribeFn = null;
    }
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
  async enableSpellchecker(lang = undefined, automaticallyIdentifyLanguages = undefined, isPassiveMode = undefined) {
    if (this.isEnabled) {
      return true;
    }

    if (typeof lang === 'undefined') {
      lang = this.currentSpellcheckerLanguage || 'en-US';
    }
    if (typeof automaticallyIdentifyLanguages === 'undefined') {
      automaticallyIdentifyLanguages = this.automaticallyIdentifyLanguages;
    }
    if (typeof isPassiveMode === 'undefined') {
      isPassiveMode = this.isPassiveMode;
    }

    this.memoryDictionary.loadForLanguage();

    if (!this.isHunspell) {
      // Using macOS native spell checker.
      this.currentSpellchecker = new Spellchecker();
      this.isEnabled = true;

      // Keep automatic language detection enabled.
      if (automaticallyIdentifyLanguages) {
        // Set fallback value.
        this.currentSpellcheckerLanguage = lang;
        this.automaticallyIdentifyLanguages = true;
        this.isPassiveMode = isPassiveMode;

        this.attachToInput();
        if (webFrame) {
          this.setSpellCheckProvider(webFrame);
        }

        this.bus.emit('currentSpellcheckerChanged', true);
        return true;
      }
      // else: fallthrough and switch language
    }

    // Using Hunspell

    this.currentSpellcheckerLanguage = lang;
    this.automaticallyIdentifyLanguages = automaticallyIdentifyLanguages;
    this.isPassiveMode = isPassiveMode;

    const result = await this.switchLanguage(lang);
    if (result) {
      this.attachToInput();
    }
    return result;
  }

  /**
   * Disable spell checking and unload the spell checker native module.
   */
  disableSpellchecker() {
    this.unsubscribe();
    this.currentSpellchecker = null;
    this.userDictionary.unload();
    this.memoryDictionary.unload();
    this.isEnabled = false;
  }

  /**
   * Override the default logger for this class. You probably want to use
   * {{setGlobalLogger}} instead
   *
   * @param {Function} fn   The function which will operate like console.log
   */
  static setLogger(fn) {
    d = fn;
  }

  /**
   * Attach to document.body and register ourselves for Electron spell checking.
   * This method will start to watch text entered by the user and automatically
   * switch languages as well as enable Electron spell checking (i.e. the red
   * squigglies).
   *
   * @param {[HTMLElement]} container The optional container to attach the
   *                                  automatic spell detection when using
   *                                  Hunspell. Default `document.body`.
   */
  attachToInput(container=null) {
    // OS X has no need for any of this except for passive mode.
    if (!this.isHunspell && !this.isPassiveMode) {
      return;
    }

    let wordsTyped = 0;
    let lastInputText = '';

    if (!container && !document.body) {
      throw new Error("document.body and container are null, if you're calling this in a preload script you need to wrap it in a setTimeout");
    } else if (this._unsubscribeFn) {
      throw new Error('Spellchecker is already attach to input. Please use default values to capture the full document.');
    }

    const inputHandler = e => {
      if (!this.automaticallyIdentifyLanguages || !e.target) return;
      const value = e.target.isContentEditable ? e.target.textContent : e.target.value;
      if (!value) return;

      if (value.match(/\S\s$/)) {
        wordsTyped++;
      }

      if (wordsTyped > 2) {
        if (this.isPassiveMode) {
          // Reset counter because spell checking is disabled on the document - don't overflow.
          wordsTyped = 0;
        } else {
          d(`${wordsTyped} words typed without spell checking invoked, redetecting language`);
        }
        this.bus.emit('possiblySwitchedCharacterSets');
      }

      lastInputText = value;
    };

    const element = container || document.body;
    element.addEventListener('input', inputHandler, true);
    this._unsubscribeFn = () => {
      element.removeEventListener('input', inputHandler, true);
    };

    // NB: When users switch character sets (i.e. we're checking in English and
    // the user suddenly starts typing in Russian), the spellchecker will no
    // longer invoke us, so we don't have a chance to re-detect the language.
    //
    // If we see too many words typed without a spelling detection, we know we
    // should start rechecking the input box for a language change.
    this.bus.on('spellCheckInvoked', () => wordsTyped = 0);
    this.bus.on('currentSpellcheckerChanged', () => wordsTyped = 0);
    this.bus.on('resetAutoDetection', () => {
      lastInputText = '';
      wordsTyped = 0;
    });

    const detectLanguage = pThrottle(async () => {
      if (!this.automaticallyIdentifyLanguages || lastInputText.length < 8) {
        return;
      }

      let text = lastInputText;
      if (text.length > 256) {
        text = text.substr(text.length - 256);
      }

      d(`Attempting detection, string length: ${text.length} (total=${lastInputText.length})`);

      let langWithoutLocale;
      try {
        langWithoutLocale = await this.detectLanguageForText(text);
      } catch (e) {
        d(`Failed to detect language: ${e.message}`);
        return;
      }

      d(`Auto-detected language as ${langWithoutLocale}`);
      let lang = await this.getLikelyLocaleForLanguage(langWithoutLocale);
      if (lang !== this.currentSpellcheckerLanguage || !this.currentSpellchecker) {
        try {
          // Current dictionary not available.
          if (!this.switchLanguage(lang)) {
            return;
          }
        } catch (e) {
          d(`Failed to load dictionary: ${e.message}`);
          return;
        }

        d(`New Language is ${lang}`);
        // this.bus.emit('languageChanged', lang);
      }
    }, 1, 250);

    this.bus.on('spellingErrorOccurred', () => detectLanguage());
    this.bus.on('possiblySwitchedCharacterSets', () => detectLanguage());

    if (webFrame) {
      let prevSpellCheckLanguage;

      const handleLanguageChange = () => {
        if (!this.currentSpellcheckerLanguage) {
          return;
        } else if (prevSpellCheckLanguage === this.currentSpellcheckerLanguage) {
          return;
        }

        d('Actually installing spell check provider to Electron');
        this.setSpellCheckProvider(webFrame);

        prevSpellCheckLanguage = this.currentSpellcheckerLanguage;
      };

      handleLanguageChange();
      this.bus.on('currentSpellcheckerChanged', () => handleLanguageChange());
    }
  }

  /**
   * Switch the dictionary language to the language of the sample text provided.
   * As described in the class documentation, call this method with text most
   * likely in the same language as the user is typing. The locale (i.e. *US* vs
   * *UK* vs *AU*) will be inferred heuristically based on the user's computer.
   *
   * @param  {String} inputText   A language code (i.e. 'en-US')
   *
   * @return {Promise<boolean>}   Completion
   */
  async provideHintText(inputText) {
    let langWithoutLocale = null;
    if (!this.isHunspell) return false;

    try {
      langWithoutLocale = await this.detectLanguageForText(inputText.substring(0, 512));
    } catch (e) {
      d(`Couldn't detect language for text of length '${inputText.length}': ${e.message}, ignoring sample`);
      return false;
    }

    let lang = await this.getLikelyLocaleForLanguage(langWithoutLocale);
    return await this.switchLanguage(lang);
  }

  /**
   * Explicitly switch the language to a specific language. This method will
   * automatically download the dictionary for the specific language and locale
   * and on failure, will attempt to switch to dictionaries that are the same
   * language but a default locale.
   *
   * @param  {String} langCode    A language code (i.e. 'en-US')
   *
   * @return {Promise}            Completion
   */
  async switchLanguage(langCode) {
    let actualLang;
    let dict = null;

    this.isMisspelledCache.reset();

    // Set language on macOS (OS spell checker)
    if (!this.isHunspell) {
      if (!this.currentSpellchecker) {
        d('Spellchecker is not initialized');
        this.isEnabled = false;
        this.invalidState = true;
        return false;
      }

      d(`Setting current spellchecker to ${langCode}`);

      // An empty language code enables the automatic language detection.
      if (!langCode) {
        this._automaticallyIdentifyLanguages = true;
        this.currentSpellcheckerLanguage = this.currentSpellcheckerLanguage || 'en-US';
      } else {
        this._automaticallyIdentifyLanguages = false;
        this.currentSpellcheckerLanguage = langCode;
      }

      this.invalidState = false;
      return this.currentSpellchecker.setDictionary(langCode);
    }

    // Set language with Hunspell
    try {
      const {dictionary, language} = await this.loadDictionaryForLanguageWithAlternatives(langCode);
      actualLang = language; dict = dictionary;
    } catch (e) {
      d(`Failed to load dictionary ${langCode}: ${e.message}`);
      throw e;
    }

    if (!dict) {
      d(`dictionary for ${langCode}_${actualLang} is not available`);

      this.currentSpellcheckerLanguage = actualLang;
      this.currentSpellchecker = null;
      this.userDictionary.unload();
      this.isEnabled = false;
      this.invalidState = true;
      this.bus.emit('currentSpellcheckerChanged', false);
      return false;
    }

    d(`Setting current spellchecker to ${actualLang}, requested language was ${langCode}`);
    if (this.currentSpellcheckerLanguage !== actualLang || !this.currentSpellchecker) {
      d(`Creating node-spellchecker instance`);

      this.currentSpellchecker = new Spellchecker();
      this.currentSpellchecker.setDictionary(actualLang, dict);
      this.currentSpellcheckerLanguage = actualLang;
      this.userDictionary.loadForLanguage(actualLang);
      this.isEnabled = true;
      this.invalidState = false;
      this.bus.emit('currentSpellcheckerChanged', true);
    }
    return true;
  }

  /**
   * Loads a dictionary and attempts to use fallbacks if it fails.
   * @private
   */
  async loadDictionaryForLanguageWithAlternatives(langCode) {
    if (!langCode) {
      throw new Error('loadDictionaryForLanguageWithAlternatives: Invalid language code.')
    }

    this.fallbackLocaleTable = this.fallbackLocaleTable || require('./fallback-locales');
    let lang = langCode.split(/[-_]/)[0];

    let alternatives = [langCode, await this.getLikelyLocaleForLanguage(lang), this.fallbackLocaleTable[lang]];
    if (langCode in alternatesTable) {
      try {
        return {
          language: alternatesTable[langCode],
          dictionary: await this.dictionarySync.loadDictionaryForLanguage(alternatesTable[langCode])
        };
      } catch (e) {
        d(`Failed to load language ${langCode}, altTable=${alternatesTable[langCode]}, error=${e.message}`);
        delete alternatesTable[langCode];
      }
    }

    for (const language of alternatives) {
      try {
        const dictionary = await this.dictionarySync.loadDictionaryForLanguage(language);
        alternatesTable[langCode] = language;
        return { language, dictionary };
      } catch (e) {
        d(`Failed to load language ${langCode}, altTable=${language}, error=${e.message}`);
      }
    }
    return { language: langCode, dictionary: null };
  }

  /**
   *  Sets the SpellCheckProvider on the given WebFrame.
   *  @private
   *  @param {*} webFrame
   */
  setSpellCheckProvider(webFrame) {
    webFrame.setSpellCheckProvider(
      this.currentSpellcheckerLanguage,
      { spellCheck: this.handleElectronSpellCheck.bind(this) });
  }

  /**
   *  The actual callout called by Electron version 5 and above to handle
   *  spellchecking.
   *  @private
   */
  handleElectronSpellCheck(words, callback) {
    if (!this.currentSpellchecker || this.isPassiveMode) {
      callback([]);
      return;
    }

    let misspelled = words.filter(w => w.length > 1 && this.isMisspelled(w));

    if (!this.isHunspell) {
      callback(misspelled);
      return;
    }

    this.bus.emit('spellCheckInvoked', true);
    if (this.automaticallyIdentifyLanguages) {
      // Event is only used to reset the typed words counter.
      this.bus.emit('spellingErrorOccurred');
      // misspelled.forEach(w => this.bus.emit('spellingErrorOccurred', w));
    }
    callback(misspelled);
  }

  /**
   * Calculates whether a word is missspelled, using an LRU cache to memoize
   * the callout to the actual spell check code.
   *
   * @private
   */
  isMisspelled(text) {
    let result = this.isMisspelledCache.get(text);
    if (result !== undefined) {
      return result;
    }

    result = (() => {
      if (contractionMap[text.toLocaleLowerCase()]) {
        return false;
      }

      if (!this.currentSpellchecker) return false;

      if (!this.isHunspell) {
        return this.currentSpellchecker.isMisspelled(text);
      }

      // Check custom user dictionary for Hunspell first.
      if (this.userDictionary.match(text)) {
        return false;
      } else if (this.memoryDictionary.match(text)) {
        return false;
      }

      // NB: I'm not smart enough to fix this bug in Chromium's version of
      // Hunspell so I'm going to fix it here instead. Chromium Hunspell for
      // whatever reason marks the first word in a sentence as mispelled if it is
      // capitalized.
      result = this.currentSpellchecker.checkSpelling(text);
      if (result.length < 1) {
        return false;
      }

      if (result[0].start !== 0) {
        // If we're not at the beginning, we know it's not a false positive
        return true;
      }

      // Retry with lowercase
      return this.currentSpellchecker.isMisspelled(text.toLocaleLowerCase());
    })();

    this.isMisspelledCache.set(text, result);
    return result;
  }

  /**
   * Calls out to cld2 to detect the language of the given text
   * @private
   */
  detectLanguageForText(text) {
    return new Promise((res,rej) => {
      setTimeout(() => cld.detect(text).then(res, rej), 10);
    });
  }

  /**
   * Returns the locale for a language code based on the user's machine (i.e.
   * 'en' => 'en-GB')
   */
  async getLikelyLocaleForLanguage(language) {
    let lang = language.toLowerCase();
    if (!this.likelyLocaleTable) this.likelyLocaleTable = await this.buildLikelyLocaleTable();

    if (this.likelyLocaleTable[lang]) return this.likelyLocaleTable[lang];
    this.fallbackLocaleTable = this.fallbackLocaleTable || require('./fallback-locales');

    return this.fallbackLocaleTable[lang];
  }

  /**
   * A proxy for the current spellchecker's method of the same name
   */
  async getCorrectionsForMisspelling(text) {
    // NB: This is async even though we don't use await, to make it easy for
    // ContextMenuBuilder to use this method even when it's hosted in another
    // renderer process via electron-remote.
    if (!this.currentSpellchecker) {
      return null;
    }

    return this.currentSpellchecker.getCorrectionsForMisspelling(text);
  }

  /**
   * Add a word to the user dictionary.
   *
   * @param {string} word The word to add.
   */
  async addToDictionary(word) {
    if (!this.currentSpellchecker) return;

    this.isMisspelledCache.del(word);

    // Handle NSSpellChecker
    if (!this.isHunspell) {
      this.currentSpellchecker.add(word);
      return;
    }

    // Add word to our custom user dictionary.
    this.userDictionary.add(word);
  }

  /**
   * Remove a word from the user dictionary.
   *
   * @param {string} word The word to remove.
   */
  async removeFromDictionary(word) {
    if (!this.currentSpellchecker) return;

    this.isMisspelledCache.del(word);

    // Handle NSSpellChecker
    if (!this.isHunspell) {
      this.currentSpellchecker.remove(word);
      return;
    }

    // Remove word from our custom user dictionary.
    this.userDictionary.remove(word);
  }

  /**
   * Ignore a word for the current runtime.
   *
   * @param {string} word The word to ignore.
   */
  ignoreWord(word) {
    if (!this.currentSpellchecker) return;

    this.isMisspelledCache.del(word);
    this.memoryDictionary.add(word);
  }

  /**
   * Call out to the OS to figure out what locales the user is probably
   * interested in then save it off as a table.
   * @private
   */
  async buildLikelyLocaleTable() {
    let localeList = [];

    if (process.platform === 'linux') {
      // Use LANG instead `locale -a` because it will dump all possible languages.
      if (process.env.LANG) {
        let m = process.env.LANG.match(validLangCodeWindowsLinux);
        if (m) {
          try {
            localeList = [ normalizeLanguageCode(m[0]) ];
          } catch (error) {
            d(`Error normalize language code: ${error}`);
          }
        }
      }
    }

    if (process.platform === 'win32') {
      localeList = require('keyboard-layout').getInstalledKeyboardLanguages();
    }

    if (isMac) {
      fallbackLocaleTable = fallbackLocaleTable || require('./fallback-locales');

      if (!this.isHunspell) {
        // NB: OS X will return lists that are half just a language, half
        // language + locale, like ['en', 'pt_BR', 'ko']
        localeList = this.currentSpellchecker.getAvailableDictionaries();
      } else {
        // Also the keyboad language might be just a 2-letter ISO code.
        localeList = require('keyboard-layout').getInstalledKeyboardLanguages();
      }

      localeList = localeList
        .map((x => {
          if (x.length === 2) return fallbackLocaleTable[x];
          try {
            return normalizeLanguageCode(x);
          } catch (error) {
            d(`Error normalize language code: ${error}`);
            return null;
          }
        }));
    }

    d(`Filtered Locale list: ${JSON.stringify(localeList)}`);

    // Some distros like Ubuntu make locale -a useless by dumping
    // every possible locale for the language into the list :-/
    let counts = localeList.reduce((acc,x) => {
      if (!x) return acc;

      let k = x.split(/[-_\.]/)[0];
      acc[k] = acc[k] || [];
      acc[k].push(x);

      return acc;
    }, {});

    d(`Counts: ${JSON.stringify(counts)}`);

    let ret = Object.keys(counts).reduce((acc, x) => {
      if (counts[x].length > 1) return acc;

      try {
        d(`Setting ${x}`);
        acc[x] = normalizeLanguageCode(counts[x][0]);
      } catch (error) {
        d(`Error reduce likely locale table: ${error}`);
      }

      return acc;
    }, {});

    d(`Result: ${JSON.stringify(ret)}`);
    return ret;
  }
};
