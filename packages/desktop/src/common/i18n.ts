import fs from 'fs'
import path from 'path'

export type Translations = Record<string, unknown>

const SUPPORTED_LANGUAGES = ['en', 'zh-CN', 'zh-TW', 'es', 'fr', 'de', 'ja', 'ko', 'nl', 'pt', 'tr', 'ru'] as const

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

let translationsCache: Record<string, Translations> = {}

// Directory holding `<language>.json` and the minified `<language>.min.json`.
// The main process points it at the app's resources while bootstrapping (see
// main/globalSetting.ts); the default suits a run from the package directory.
let localesDirectory = path.join(process.cwd(), 'static', 'locales')

/**
 * Sets where the locale files are read from. Translations already read are
 * dropped so the next lookup uses the new directory.
 */
function setLocalesDirectory(directory: string): void {
  localesDirectory = directory
  translationsCache = {}
}

/**
 * Loads the translation file for the specified language. Falls back to English
 * on error; returns null if even the English fallback can't be loaded.
 */
function loadTranslations(language: string): Translations | null {
  if (translationsCache[language]) {
    return translationsCache[language]
  }

  try {
    // Prefer the minified file, which every packaged build ships, but fall back
    // to the raw .json so a checkout works without running minify-locales.
    const minPath = path.join(localesDirectory, `${language}.min.json`)
    const rawPath = path.join(localesDirectory, `${language}.json`)
    const localePath = fs.existsSync(minPath) ? minPath : rawPath

    if (!fs.existsSync(localePath)) {
      throw new Error(`Translation file not found for language: ${language}`)
    }

    const content = fs.readFileSync(localePath, 'utf8')

    const translationData: Translations = JSON.parse(content)

    translationsCache[language] = translationData
    return translationData
  } catch (error) {
    console.error('Error loading translation:', error)
    if (language !== 'en') {
      return loadTranslations('en')
    }
    return null
  }
}

/**
 * Gets the translated text. Supports dot-separated nested keys; substitutes
 * `{param}` tokens with values from the optional `params` map.
 */
function getTranslation(
  key: string,
  language: string = 'en',
  params: Record<string, string | number> = {}
): string {
  const translations = loadTranslations(language)

  if (!translations) {
    return key
  }

  const keys = key.split('.')
  let probe: unknown = translations

  for (const segment of keys) {
    if (probe && typeof probe === 'object' && segment in (probe as Record<string, unknown>)) {
      probe = (probe as Record<string, unknown>)[segment]
    } else {
      return key
    }
  }

  if (typeof probe !== 'string') {
    return key
  }

  let result = probe
  for (const [param, replacement] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${param}\\}`, 'g'), () => String(replacement))
  }

  return result
}

function getSupportedLanguages(): string[] {
  return [...SUPPORTED_LANGUAGES]
}

function isLanguageSupported(language: string): boolean {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(language)
}

/**
 * Maps a system locale (e.g. `zh`, `zh-HK`, `pt-PT`) to a supported language
 * code: exact match first, then any supported language with the same primary
 * subtag. Returns null when nothing matches, including for an empty locale —
 * `app.getLocale()` returns an empty string before the app is ready, and an
 * empty primary subtag would otherwise match every entry.
 */
function matchSupportedLanguage(locale: string): string | null {
  if (!locale) {
    return null
  }
  if (isLanguageSupported(locale)) {
    return locale
  }
  const primarySubtag = locale.split('-')[0]!.toLowerCase()

  // The zh family splits by script rather than region: traditional characters
  // are used in TW, HK and MO (zh-Hant), everything else is simplified.
  if (primarySubtag === 'zh') {
    const secondSubtag = (locale.split('-')[1] ?? '').toLowerCase()
    return ['tw', 'hk', 'mo', 'hant'].includes(secondSubtag) ? 'zh-TW' : 'zh-CN'
  }

  return (
    getSupportedLanguages().find(lang => lang.split('-')[0]!.toLowerCase() === primarySubtag) ??
    null
  )
}

function clearCache(): void {
  translationsCache = {}
}

function getAllTranslations(language: string): Translations | null {
  return loadTranslations(language)
}

export {
  getTranslation,
  getSupportedLanguages,
  isLanguageSupported,
  matchSupportedLanguage,
  clearCache,
  getAllTranslations,
  loadTranslations,
  setLocalesDirectory
}
