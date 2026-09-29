/** Shared i18n / language-pack types (no Node imports — used by preload and renderer). */

export type LanguagePackSource = 'builtin' | 'user' | 'cwd'

export interface LanguageCatalogEntry {
  id: string
  name: string
  nativeName: string
  author?: string
  version?: string
  source: LanguagePackSource
  hasMuya: boolean
}
