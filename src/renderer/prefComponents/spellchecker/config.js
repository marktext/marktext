export const getLanguageName = langCode => {
  const item = DICTIONARIES_LANGUAGES_OPTIONS.find(item => item.value === langCode)
  if (!item) {
    return `Unknown (${langCode})`
  }
  return item.label
}

export const DICTIONARIES_LANGUAGES_OPTIONS = [{
  label: 'Afrikaans', // Afrikaans
  value: 'af-ZA'
}, {
  label: 'български език', // Bulgarian
  value: 'bg-BG'
}, {
  label: 'Català', // Catalan; Valencian
  value: 'ca-ES'
}, {
  label: 'Česky, čeština', // Czech
  value: 'cs-CZ'
}, {
  label: 'Dansk', // Danish
  value: 'da-DK'
}, {
  label: 'Deutsch', // German
  value: 'de-DE'
}, {
  label: 'Ελληνικά', // Greek, Modern
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
  label: 'Español', // Spanish; Castilian
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
  label: 'हिन्दी, हिंदी', // Hindi
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
  label: '한국어 (韓國語)', // Korean
  value: 'ko'
}, {
  label: 'Lietuvių kalba', // Lithuanian
  value: 'lt-LT'
}, {
  label: 'Latviešu valoda', // Latvian
  value: 'lv-LV'
}, {
  label: 'Norsk bokmål', // Norwegian Bokmål
  value: 'nb-NO'
}, {
  label: 'Nederlands, Vlaams', // Dutch
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
  label: 'Pусский язык', // Russian
  value: 'ru-RU'
}, {
  label: 'Cрпски језик (Latin)', // Serbian (Latin)
  value: 'sh' // aka sr-Latn
}, {
  label: 'Slovenčina', // Slovak
  value: 'sk-SK'
}, {
  label: 'Slovenščina', // Slovene
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
  label: 'тоҷикӣ ( تاجیکی)‎', // Tajik
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
}]
