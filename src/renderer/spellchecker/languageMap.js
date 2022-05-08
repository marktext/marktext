import langMap from 'iso-639-1'

/**
 * Return the native language name by language code.
 *
 * @param {string} langCode The ISO two or four-letter language code (e.g. en, en-US) or BCP-47 code.
 */
export const getLanguageName = languageCode => {
  if (!languageCode || languageCode.length < 2) {
    return null
  }

  let language = ''

  // First try to get an exact language via 4-letter ISO code.
  if (languageCode.length === 5) {
    language = getHunspellLanguageName(languageCode)
    if (language) {
      return language
    }
  }

  language = langMap.getNativeName(languageCode.substr(0, 2))
  if (language) {
    // Add language code to distinguish between native name (en-US, en-GB, ...).
    return `${language} (${languageCode})`
  }
  return `Unknown (${languageCode})`
}

/**
 * Return the native language name by language code for supported Hunspell languages.
 *
 * @param {string} langCode The ISO 4-letter language code.
 */
const getHunspellLanguageName = langCode => {
  const item = HUNSPELL_DICTIONARY_LANGUAGE_MAP.find(item => item.value === langCode)
  if (!item) {
    return null
  }
  return item.label
}

// All available Hunspell dictionary languages.
const HUNSPELL_DICTIONARY_LANGUAGE_MAP = Object.freeze([{
  label: 'Afrikaans', // Afrikaans
  value: 'af-ZA'
}, {
  label: 'български език', // Bulgarian
  value: 'bg-BG'
}, {
  label: 'Català', // Catalan
  value: 'ca-ES'
}, {
  label: 'Česky', // Czech
  value: 'cs-CZ'
}, {
  label: 'Dansk', // Danish
  value: 'da-DK'
}, {
  label: 'Deutsch', // German
  value: 'de-DE'
}, {
  label: 'Ελληνικά', // Greek
  value: 'el-GR'
}, {
  label: 'English (en-AU)', // English
  value: 'en-AU'
}, {
  label: 'English (en-CA)', // English
  value: 'en-CA'
}, {
  label: 'English (en-GB)', // English
  value: 'en-GB'
}, {
  label: 'English (en-US)', // English
  value: 'en-US'
}, {
  label: 'Español', // Spanish
  value: 'es-ES'
}, {
  label: 'Eesti', // Estonian
  value: 'et-EE'
}, {
  label: 'Føroyskt', // Faroese
  value: 'fo-FO'
}, {
  label: 'Français', // French
  value: 'fr-FR'
}, {
  label: 'עברית', // Hebrew (modern)
  value: 'he-IL'
}, {
  label: 'हिन्दी', // Hindi
  value: 'hi-IN'
}, {
  label: 'Hhrvatski', // Croatian
  value: 'hr-HR'
}, {
  label: 'Magyar', // Hungarian
  value: 'hu-HU'
}, {
  label: 'Bahasa Indonesia', // Indonesian
  value: 'id-ID'
}, {
  label: 'Italiano', // Italian
  value: 'it-IT'
}, {
  label: '한국어', // Korean
  value: 'ko'
}, {
  label: 'Lietuvių', // Lithuanian
  value: 'lt-LT'
}, {
  label: 'Latviešu', // Latvian
  value: 'lv-LV'
}, {
  label: 'Norsk', // Norwegian
  value: 'nb-NO'
}, {
  label: 'Nederlands', // Dutch
  value: 'nl-NL'
}, {
  label: 'Polski', // Polish
  value: 'pl-PL'
}, {
  label: 'Português (pt-BR)', // Portuguese
  value: 'pt-BR'
}, {
  label: 'Português (pt-PT)', // Portuguese
  value: 'pt-PT'
}, {
  label: 'Română', // Romanian
  value: 'ro-RO'
}, {
  label: 'Pусский', // Russian
  value: 'ru-RU'
}, {
  label: 'Cрпски језик (Latin)', // Serbian (Latin)
  value: 'sh' // aka sr-Latn
}, {
  label: 'Slovenčina (sk-SK)', // Slovak
  value: 'sk-SK'
}, {
  label: 'Slovenščina (sl-SI)', // Slovene
  value: 'sl-SI'
}, {
  label: 'Shqip', // Albanian
  value: 'sq'
}, {
  label: 'Cрпски језик', // Serbian
  value: 'sr'
}, {
  label: 'Svenska', // Swedish
  value: 'sv-SE'
}, {
  label: 'தமிழ்', // Tamil
  value: 'ta-IN'
}, {
  label: 'тоҷикӣ', // Tajik
  value: 'tg-TG'
}, {
  label: 'Türkçe', // Turkish
  value: 'tr-TR'
}, {
  label: 'українська', // Ukrainian
  value: 'uk-UA'
}, {
  label: 'Tiếng Việt', // Vietnamese
  value: 'vi-VN'
}])
