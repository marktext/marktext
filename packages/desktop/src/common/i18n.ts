import fs from 'fs'
import path from 'path'
import {
  getBuiltinLanguageIds,
  getLanguageCatalog,
  getLanguagePack,
  getMuyaResource,
  getSupportedLanguageIds,
  isLanguageRegistered,
  reloadLanguagePacks,
  type LanguageCatalogEntry,
  type LanguagePackSource
} from './langPacks'

export type Translations = Record<string, unknown>
export type { LanguageCatalogEntry, LanguagePackSource }

/** Fallback before any directory has been scanned (e.g. bare unit tests). */
const FALLBACK_LANGUAGES = [
  'en',
  'zh-CN',
  'zh-TW',
  'es',
  'fr',
  'de',
  'ja',
  'ko',
  'nl',
  'pt',
  'tr',
  'ru'
] as const

let translationsCache: Record<string, Translations> = {}

// Directory holding built-in `<language>.json` and `<language>.min.json`.
// The main process points it at the app's resources while bootstrapping (see
// main/globalSetting.ts); the default suits a run from the package directory.
let localesDirectory = path.join(process.cwd(), 'static', 'locales')

// Extra plugin directories (user data, portable cwd, …), scanned after the
// built-in pack so a drop-in can override a shipped translation.
let packDirs: Array<{ directory: string; source: LanguagePackSource }> = []

function rebuildRegistry(): void {
  translationsCache = {}
  reloadLanguagePacks([{ directory: localesDirectory, source: 'builtin' }, ...packDirs])
}

/**
 * Sets where the built-in locale files are read from and rescans plugins.
 */
function setLocalesDirectory(directory: string): void {
  localesDirectory = directory
  rebuildRegistry()
}

/**
 * Registers additional language-pack directories (user / portable). Later
 * calls replace the previous plugin list; built-in packs stay first.
 */
function setLanguagePackDirectories(directories: Array<{ directory: string; source: LanguagePackSource }>): void {
  packDirs = directories.filter(d => !!d.directory)
  rebuildRegistry()
}

/**
 * Loads the translation tree for the specified language. Falls back to English
 * on error; returns null if even the English fallback can't be loaded.
 *
 * The returned object includes `$meta` / `$muya` when the pack defines them so
 * the renderer can show pack metadata and feed the editor engine.
 */
function loadTranslations(language: string): Translations | null {
  if (translationsCache[language]) {
    return translationsCache[language]
  }

  try {
    const pack = getLanguagePack(language)
    if (pack) {
      const payload: Translations = { ...pack.messages }
      if (pack.muya) payload.$muya = pack.muya
      payload.$meta = {
        id: pack.id,
        name: pack.name,
        nativeName: pack.nativeName,
        author: pack.author,
        version: pack.version,
        source: pack.source,
        hasMuya: pack.hasMuya
      }
      translationsCache[language] = payload
      return payload
    }

    // Legacy path: a bare file next to the built-in locales that was not
    // registered (registry not rebuilt yet).
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
  language: string = 'zh-CN',
  params: Record<string, string | number> = {}
): string {
  const translations = loadTranslations(language)

  if (!translations) {
    return key
  }

  // `$meta` / `$muya` are pack bookkeeping, never UI copy.
  if (key.startsWith('$')) {
    return key
  }

  const keys = key.split('.')
  let probe: unknown = translations

  for (const segment of keys) {
    if (probe && typeof probe === 'object' && segment in (probe as Record<string, unknown>)) {
      probe = (probe as Record<string, unknown>)[segment]
    } else {
      probe = undefined
      break
    }
  }

  if (typeof probe !== 'string') {
    // Fall back to English before giving up, so a partial locale still shows text.
    if (language !== 'en') {
      return getTranslation(key, 'en', params)
    }
    return key
  }

  let result = probe
  for (const [param, replacement] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${param}\\}`, 'g'), () => String(replacement))
  }

  return result
}

function getSupportedLanguages(): string[] {
  const ids = getSupportedLanguageIds()
  return ids.length ? ids : [...FALLBACK_LANGUAGES]
}

function getBuiltinLanguages(): string[] {
  const ids = getBuiltinLanguageIds()
  return ids.length ? ids : [...FALLBACK_LANGUAGES]
}

function getLanguageCatalogEntries(): LanguageCatalogEntry[] {
  const catalog = getLanguageCatalog()
  if (catalog.length) return catalog
  return FALLBACK_LANGUAGES.map(id => ({
    id,
    name: id,
    nativeName: id,
    source: 'builtin' as const,
    hasMuya: false
  }))
}

function isLanguageSupported(language: string): boolean {
  if (isLanguageRegistered(language)) return true
  return (FALLBACK_LANGUAGES as readonly string[]).includes(language)
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
    const zhTarget = ['tw', 'hk', 'mo', 'hant'].includes(secondSubtag) ? 'zh-TW' : 'zh-CN'
    return isLanguageSupported(zhTarget) ? zhTarget : null
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
  getBuiltinLanguages,
  getLanguageCatalogEntries,
  getMuyaResource,
  isLanguageSupported,
  matchSupportedLanguage,
  clearCache,
  getAllTranslations,
  loadTranslations,
  setLocalesDirectory,
  setLanguagePackDirectories
}
