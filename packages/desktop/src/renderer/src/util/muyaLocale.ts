import { en, de, es, fr, ja, ko, nl, pt, ru, tr, zhCN, zhTW, type ILocale } from '@muyajs/core'

// Maps the desktop language preference onto the engine's bundled locale
// objects. Plugin language packs may ship editor strings in their `muya` /
// `$muya` section; those are registered when the pack loads (see
// registerPackMuyaResource) and win over this map. Anything still missing
// falls back to English so app chrome can be translated even when the engine
// UI is not (#5499).
export const MUYA_LOCALES: Record<string, ILocale> = {
  en,
  de,
  es,
  fr,
  ja,
  ko,
  nl,
  pt,
  ru,
  tr,
  'zh-CN': zhCN,
  'zh-TW': zhTW
}

const packMuyaResources: Record<string, Record<string, string>> = {}

/** Lets a language pack override the engine's UI strings at runtime. */
export const registerPackMuyaResource = (
  language: string,
  resource: Record<string, string> | null
): void => {
  if (resource && Object.keys(resource).length) {
    packMuyaResources[language] = resource
  } else {
    delete packMuyaResources[language]
  }
}

export const getMuyaLocale = (language: string): ILocale => {
  const packResource = packMuyaResources[language]
  if (packResource) {
    return { name: language, resource: packResource }
  }
  return MUYA_LOCALES[language] ?? en
}
