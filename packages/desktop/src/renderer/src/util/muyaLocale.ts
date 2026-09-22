import { en, de, es, fr, ja, ko, nl, pt, ru, tr, zhCN, zhTW, type ILocale } from '@muyajs/core'

// Maps the desktop language preference onto the engine's bundled locale
// objects. Keys must cover every tag in SUPPORTED_LANGUAGES (common/i18n.ts):
// a tag with no entry here falls back to English, so the application chrome
// would be translated while the editor's own UI is not (#5499).
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

export const getMuyaLocale = (language: string): ILocale => MUYA_LOCALES[language] ?? en
