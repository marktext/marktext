const {spawn} = require('spawn-rx');
// const {requireTaskPool} = require('@aabuhijleh/electron-remote');
const LRU = require('lru-cache');

const {Subscription} = require('rxjs/Subscription');
const {Observable} = require('rxjs/Observable');
const {Subject} = require('rxjs/Subject');
const SerialSubscription = require('rxjs-serial-subscription').default;

require('rxjs/add/observable/merge');
require('rxjs/add/observable/defer');
require('rxjs/add/observable/empty');
require('rxjs/add/observable/fromEvent');
require('rxjs/add/observable/fromPromise');
require('rxjs/add/observable/of');

require('rxjs/add/operator/catch');
require('rxjs/add/operator/concat');
require('rxjs/add/operator/concatMap');
require('rxjs/add/operator/do');
require('rxjs/add/operator/filter');
require('rxjs/add/operator/mergeMap');
require('rxjs/add/operator/merge');
require('rxjs/add/operator/observeOn');
require('rxjs/add/operator/reduce');
require('rxjs/add/operator/startWith');
require('rxjs/add/operator/take');
require('rxjs/add/operator/takeUntil');
require('rxjs/add/operator/throttle');
require('rxjs/add/operator/toPromise');

require('./custom-operators');

const DictionarySync = require('./dictionary-sync');
const {normalizeLanguageCode} = require('./utility');

let Spellchecker;

let d = require('debug')('electron-spellchecker:spell-check-handler');

// TODO: Asynchronously check language via Web Workers?
const cld = require.resolve('./cld2') // requireTaskPool(require.resolve('./cld2'));

let fallbackLocaleTable = null;
let webFrame = (process.type === 'renderer' ?
  require('electron').webFrame :
  null);

// NB: Linux and Windows uses underscore in languages (i.e. 'en_US'), whereas
// we're trying really hard to match the Chromium way of `en-US`
const validLangCodeWindowsLinux = /[a-z]{2}[_][A-Z]{2}/;

const isMac = process.platform === 'darwin';

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

/**
 * This method mimics Observable.fromEvent, but with capture semantics.
 */
function fromEventCapture(element, name) {
  return Observable.create((subj) => {
    const handler = function(...args) {
      if (args.length > 1) {
        subj.next(args);
      } else {
        subj.next(args[0] || true);
      }
    };

    element.addEventListener(name, handler, true);
    return new Subscription(() => element.removeEventListener(name, handler, true));
  });
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
   * @param  {DictionarySync} dictionarySync  An instance of {{DictionarySync}},
   *                                          create a custom one if you want
   *                                          to override the dictionary cache
   *                                          location.
   * @param  {LocalStorage} localStorage      Deprecated.
   * @param  {Scheduler} scheduler            The Rx scheduler to use, for
   *                                          testing.
   */
  constructor(dictionarySync=null, localStorage=null, scheduler=null) {
    // NB: Require here so that consumers can handle native module exceptions.
    Spellchecker = require('./node-spellchecker').Spellchecker;

    this.isHunspell = !isMac || !!process.env['SPELLCHECKER_PREFER_HUNSPELL']
    if (dictionarySync) {
      dictionarySync.isHunspell = this.isHunspell;
    }
    this.dictionarySync = dictionarySync || new DictionarySync(this.isHunspell);
    this.switchToLanguage = new Subject();
    this.currentSpellchecker = null;
    this.currentSpellcheckerLanguage = null;
    this.currentSpellcheckerChanged = new Subject();
    this.spellCheckInvoked = new Subject();
    this.spellingErrorOccurred = new Subject();
    this.isMisspelledCache = new LRU({ max: 5000 });
    this.isEnabled = false;

    this.scheduler = scheduler;
    this._automaticallyIdentifyLanguages = true;

    this.disp = new SerialSubscription();

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
   * Disconnect the events that we connected in {{attachToInput}} or other places
   * in the class.
   */
  unsubscribe() {
    this.disp.unsubscribe();
  }

  /**
   * Enable spell checker.
   *
   * @param {[string]} lang Optional language to set.
   */
  async enableSpellchecker(lang = '') {
    if (this.isEnabled) {
      return false;
    }

    if (!this.isHunspell) {
      this.currentSpellchecker = new Spellchecker();
      this.isEnabled = true;

      // Keep automatic language detection enabled.
      if (this.automaticallyIdentifyLanguages) {
        this.currentSpellcheckerLanguage = 'en-US';
        this._automaticallyIdentifyLanguages = true;
        this.currentSpellcheckerChanged.next(true);
        return true;
      }
    }

    let language = this.currentSpellcheckerLanguage
    if (lang) {
      language = lang
    } else if (!language) {
      return false
    }
    return await this.switchLanguage(language);
  }

  /**
   * Disable spell checking and unload the spell checker native module.
   */
  disableSpellchecker() {
    this.unsubscribe()
    this.currentSpellchecker = null;
    this.isEnabled = false;
    this.currentSpellcheckerChanged.next(true);
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
   * @param  {Observable<String>} inputText     Simulate the user typing text,
   *                                            for testing.
   *
   * @return {Disposable}       A Disposable which will unregister all of the
   *                            things that this method registered.
   */
  attachToInput(inputText=null) {
    // OS X has no need for any of this
    if (!this.isHunspell && !inputText) {
      return Subscription.EMPTY;
    }

    let possiblySwitchedCharacterSets = new Subject();
    let wordsTyped = 0;

    if (!inputText && !document.body) {
      throw new Error("document.body is null, if you're calling this in a preload script you need to wrap it in a setTimeout");
    }

    let input = inputText || (fromEventCapture(document.body, 'input')
      .mergeMap((e) => {
        if (!e.target) return Observable.empty();
        const value = e.target.isContentEditable ? e.target.textContent : e.target.value;
        if (!value) return Observable.empty();

        if (value.match(/\S\s$/)) {
          wordsTyped++;
        }

        if (wordsTyped > 2) {
          d(`${wordsTyped} words typed without spell checking invoked, redetecting language`);
          possiblySwitchedCharacterSets.next(true);
        }

        return Observable.of(value);
      }));

    let disp = new Subscription();

    // NB: When users switch character sets (i.e. we're checking in English and
    // the user suddenly starts typing in Russian), the spellchecker will no
    // longer invoke us, so we don't have a chance to re-detect the language.
    //
    // If we see too many words typed without a spelling detection, we know we
    // should start rechecking the input box for a language change.
    disp.add(Observable.merge(this.spellCheckInvoked, this.currentSpellcheckerChanged)
      .subscribe(() => wordsTyped = 0));

    let lastInputText = '';
    disp.add(input.subscribe((x) => lastInputText = x));

    let initialInputText = input
      .guaranteedThrottle(250, this.scheduler)
      .takeUntil(this.currentSpellcheckerChanged);

    if (this.currentSpellcheckerLanguage) {
      initialInputText = Observable.empty();
    }

    let contentToCheck = Observable.merge(
        this.spellingErrorOccurred,
        initialInputText,
        possiblySwitchedCharacterSets)
      .mergeMap(() => {
        if (lastInputText.length < 8) return Observable.empty();
        return Observable.of(lastInputText);
      });

    let languageDetectionMatches = contentToCheck
      .filter(() => this.automaticallyIdentifyLanguages)
      .mergeMap((text) => {
        d(`Attempting detection, string length: ${text.length}`);
        if (text.length > 256) {
          text = text.substr(text.length - 256);
        }

        return Observable.fromPromise(this.detectLanguageForText(text))
          .catch(() => Observable.empty());
      });

    disp.add(languageDetectionMatches
      .mergeMap(async (langWithoutLocale) => {
        d(`Auto-detected language as ${langWithoutLocale}`);
        let lang = await this.getLikelyLocaleForLanguage(langWithoutLocale);
        if ( (lang !== this.currentSpellcheckerLanguage) || (!this.currentSpellchecker) ) await this.switchLanguage(lang);

        return lang;
      })
      .catch((e) => {
        d(`Failed to load dictionary: ${e.message}`);
        return Observable.empty();
      })
      .subscribe(async (lang) => {
        d(`New Language is ${lang}`);
      }));

    if (webFrame) {
      let prevSpellCheckLanguage;

      disp.add(this.currentSpellcheckerChanged
          .startWith(true)
        .filter(() => this.currentSpellcheckerLanguage)
        .subscribe(() => {
          if (prevSpellCheckLanguage === this.currentSpellcheckerLanguage) return;

          d('Actually installing spell check provider to Electron');
          this.setSpellCheckProvider(webFrame);

          prevSpellCheckLanguage = this.currentSpellcheckerLanguage;
        }));
    }

    this.disp.add(disp);
    return disp;
  }

  /**
   * autoUnloadDictionariesOnBlur attempts to save memory by unloading
   * dictionaries when the window loses focus.
   *
   * @return {Disposable}   A {{Disposable}} that will unhook the events listened
   *                        to by this method.
   */
  autoUnloadDictionariesOnBlur() {
    let ret = new Subscription();
    let hasUnloaded = false;

    if (!this.isHunspell) return Subscription.EMPTY;

    ret.add(Observable.fromEvent(window, 'blur').subscribe(() => {
      d(`Unloading spellchecker`);
      this.currentSpellchecker = null;
      this.isEnabled = false;
      hasUnloaded = true;
    }));

    ret.add(Observable.fromEvent(window, 'focus').mergeMap(() => {
      if (!hasUnloaded) return Observable.empty();
      if (!this.currentSpellcheckerLanguage) return Observable.empty();

      d(`Restoring spellchecker`);
      return Observable.fromPromise(this.switchLanguage(this.currentSpellcheckerLanguage))
        .catch((e) => {
          d(`Failed to restore spellchecker: ${e.message}`);
          return Observable.empty();
        });
    }).subscribe());

    return ret;
  }

  /**
   * Switch the dictionary language to the language of the sample text provided.
   * As described in the class documentation, call this method with text most
   * likely in the same language as the user is typing. The locale (i.e. *US* vs
   * *UK* vs *AU*) will be inferred heuristically based on the user's computer.
   *
   * @param  {String} inputText   A language code (i.e. 'en-US')
   *
   * @return {Promise}            Completion
   */
  async provideHintText(inputText) {
    let langWithoutLocale = null;
    if (!this.isHunspell) return;

    try {
      langWithoutLocale = await this.detectLanguageForText(inputText.substring(0, 512));
    } catch (e) {
      d(`Couldn't detect language for text of length '${inputText.length}': ${e.message}, ignoring sample`);
      return;
    }

    let lang = await this.getLikelyLocaleForLanguage(langWithoutLocale);
    await this.switchLanguage(lang);
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
    if (!this.isHunspell && this.currentSpellchecker) {
      d(`Setting current spellchecker to ${langCode}`);
      this.currentSpellcheckerLanguage = langCode;
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
      this.isEnabled = false;
      this.currentSpellcheckerChanged.next(true);
      return false;
    }

    d(`Setting current spellchecker to ${actualLang}, requested language was ${langCode}`);
    if (this.currentSpellcheckerLanguage !== actualLang || !this.currentSpellchecker) {
      d(`Creating node-spellchecker instance`);

      this.currentSpellchecker = new Spellchecker();
      this.currentSpellchecker.setDictionary(actualLang, dict);
      this.currentSpellcheckerLanguage = actualLang;
      this.isEnabled = true;
      this.currentSpellcheckerChanged.next(true);
    }
    return true;
  }

  /**
   * Loads a dictionary and attempts to use fallbacks if it fails.
   * @private
   */
  async loadDictionaryForLanguageWithAlternatives(langCode) {
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

    d(`Requesting to load ${langCode}, alternatives are ${JSON.stringify(alternatives)}`);
    return await Observable.of(...alternatives)
      .concatMap((l) => {
        return Observable.defer(() =>
            Observable.fromPromise(this.dictionarySync.loadDictionaryForLanguage(l)))
          .map((d) => ({language: l, dictionary: d}))
          .do(({language}) => {
            alternatesTable[langCode] = language;
          })
          .catch(() => Observable.of(null));
      })
      .concat(Observable.of({language: langCode, dictionary: null}))
      .filter((x) => x !== null)
      .take(1)
      .toPromise();
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
    if (!this.currentSpellchecker) {
      callback([]);
      return;
    }

    let misspelled = words.filter(w => w.length > 1 && this.isMisspelled(w));

    if (!this.isHunspell) {
      callback(misspelled);
      return;
    }

    this.spellCheckInvoked.next(true);
    misspelled.forEach(w => this.spellingErrorOccurred.next(w));
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
   * A proxy for the current spellchecker's method of the same name.
   */
  async addToDictionary(text) {
    // NB: Same deal as getCorrectionsForMisspelling.
    if (!this.currentSpellchecker) return;

    // Handle NSSpellChecker
    if (!this.isHunspell) {
      this.isMisspelledCache.reset();
      this.currentSpellchecker.add(text);
      return;
    }

    // TODO(spell): Use a custom dictionary to save user words to.
  }

  /**
   * A proxy for the current spellchecker's method of the same name
   */
  async removeFromDictionary(text) {
    // NB: Same deal as getCorrectionsForMisspelling.
    if (!this.currentSpellchecker) return;

    // Handle NSSpellChecker
    if (!this.isHunspell) {
      this.isMisspelledCache.reset();
      this.currentSpellchecker.remove(text);
      return;
    }

    // TODO(spell): Use a custom dictionary to save user words to.
  }

  /**
   * Call out to the OS to figure out what locales the user is probably
   * interested in then save it off as a table.
   * @private
   */
  async buildLikelyLocaleTable() {
    let localeList = [];

    if (process.platform === 'linux') {
      let locales = await spawn('locale', ['-a'])
        .reduce((acc,x) => { acc.push(...x.split('\n')); return acc; }, [])
        .toPromise()
        .catch(() => []);

      d(`Raw Locale list: ${JSON.stringify(locales)}`);

      localeList = locales.reduce((acc, x) => {
        let m = x.match(validLangCodeWindowsLinux);
        if (!m) return acc;

        acc.push(m[0]);
        return acc;
      }, []);
    }

    if (process.platform === 'win32') {
      // TODO(spell): Check whether this is affected by atom/keyboard-layout#54.
      localeList = require('keyboard-layout').getInstalledKeyboardLanguages();
    }

    if (isMac) {
      if (!this.isHunspell) {
        fallbackLocaleTable = fallbackLocaleTable || require('./fallback-locales');

        // NB: OS X will return lists that are half just a language, half
        // language + locale, like ['en', 'pt_BR', 'ko']
        localeList = this.currentSpellchecker.getAvailableDictionaries()
          .map((x => {
            if (x.length === 2) return fallbackLocaleTable[x];
            try {
              return normalizeLanguageCode(x);
            } catch (error) {
              d(`Error: ${error}`);
              return null;
            }
          }));
      } else {
        // TODO(spell): Test the result on macOS.
        localeList = require('keyboard-layout').getInstalledKeyboardLanguages();
      }
    }

    d(`Filtered Locale list: ${JSON.stringify(localeList)}`);

    // Some distros like Ubuntu make locale -a useless by dumping
    // every possible locale for the language into the list :-/
    let counts = localeList.reduce((acc,x) => {
      let k = x.split(/[-_\.]/)[0];
      acc[k] = acc[k] || [];
      acc[k].push(x);

      return acc;
    }, {});

    d(`Counts: ${JSON.stringify(counts)}`);

    let ret = Object.keys(counts).reduce((acc, x) => {
      if (counts[x].length > 1) return acc;

      d(`Setting ${x}`);
      acc[x] = normalizeLanguageCode(counts[x][0]);

      return acc;
    }, {});

    // NB: LANG has a Special Place In Our Hearts
    if (process.platform === 'linux' && process.env.LANG) {
      let m = process.env.LANG.match(validLangCodeWindowsLinux);
      if (!m) return ret;

      ret[m[0].split(/[-_\.]/)[0]] = normalizeLanguageCode(m[0]);
    }

    d(`Result: ${JSON.stringify(ret)}`);
    return ret;
  }
};
