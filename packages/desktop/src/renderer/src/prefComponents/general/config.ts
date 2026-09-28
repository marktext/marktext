import { t } from '../../i18n'
import type { PrefSelectOption } from '../common/types'
import type { LanguageCatalogEntry } from '@shared/types/i18n'

export const getTitleBarStyleOptions = (): PrefSelectOption<string>[] => [
  {
    label: t('preferences.general.window.titleBarStyle.custom'),
    value: 'custom'
  },
  {
    label: t('preferences.general.window.titleBarStyle.native'),
    value: 'native'
  }
]

export const zoomOptions: PrefSelectOption<number>[] = [
  {
    label: '50.0%',
    value: 0.5
  },
  {
    label: '62.5%',
    value: 0.625
  },
  {
    label: '75.0%',
    value: 0.75
  },
  {
    label: '87.5%',
    value: 0.875
  },
  {
    label: '100.0%',
    value: 1.0
  },
  {
    label: '112.5%',
    value: 1.125
  },
  {
    label: '125.0%',
    value: 1.25
  },
  {
    label: '137.5%',
    value: 1.375
  },
  {
    label: '150.0%',
    value: 1.5
  },
  {
    label: '162.5%',
    value: 1.625
  },
  {
    label: '175.0%',
    value: 1.75
  },
  {
    label: '187.5%',
    value: 1.875
  },
  {
    label: '200.0%',
    value: 2.0
  }
]

export const getFileSortByOptions = (): PrefSelectOption<string>[] => [
  {
    label: t('preferences.general.sidebar.fileSortBy.creationTime'),
    value: 'created'
  },
  {
    label: t('preferences.general.sidebar.fileSortBy.modificationTime'),
    value: 'modified'
  },
  {
    label: t('preferences.general.sidebar.fileSortBy.filename'),
    value: 'title'
  }
]

export const getFileSortOrderOptions = (sortBy: string = 'title'): PrefSelectOption<string>[] => {
  if (sortBy === 'title') {
    return [
      { label: t('preferences.general.sidebar.fileSortOrder.aToZ'), value: 'asc' },
      { label: t('preferences.general.sidebar.fileSortOrder.zToA'), value: 'desc' }
    ]
  }
  return [
    { label: t('preferences.general.sidebar.fileSortOrder.oldestFirst'), value: 'asc' },
    { label: t('preferences.general.sidebar.fileSortOrder.newestFirst'), value: 'desc' }
  ]
}

const BUILTIN_LANGUAGE_LABEL_KEYS: Record<string, string> = {
  en: 'preferences.general.misc.language.english',
  'zh-CN': 'preferences.general.misc.language.chinese',
  'zh-TW': 'preferences.general.misc.language.traditionalChinese',
  es: 'preferences.general.misc.language.spanish',
  fr: 'preferences.general.misc.language.french',
  de: 'preferences.general.misc.language.german',
  ja: 'preferences.general.misc.language.japanese',
  ko: 'preferences.general.misc.language.korean',
  nl: 'preferences.general.misc.language.dutch',
  pt: 'preferences.general.misc.language.portuguese',
  tr: 'preferences.general.misc.language.turkish',
  ru: 'preferences.general.misc.language.russian'
}

const FALLBACK_LANGUAGE_OPTIONS: PrefSelectOption<string>[] = Object.entries(
  BUILTIN_LANGUAGE_LABEL_KEYS
).map(([value, labelKey]) => ({ label: t(labelKey), value }))

// Catalog from built-in locales + drop-in language packs. Loaded at startup
// via i18nUtils.listLanguageCatalog(); the built-in label map is the fallback
// before that resolves (and in unit tests without IPC).
let cachedCatalog: LanguageCatalogEntry[] | null = null

export const setLanguageCatalog = (catalog: LanguageCatalogEntry[]): void => {
  cachedCatalog = catalog
}

export const getLanguageOptions = (): PrefSelectOption<string>[] => {
  if (!cachedCatalog) {
    return FALLBACK_LANGUAGE_OPTIONS
  }
  return cachedCatalog.map(entry => {
    const labelKey = BUILTIN_LANGUAGE_LABEL_KEYS[entry.id]
    return {
      label:
        entry.source === 'builtin' && labelKey ? t(labelKey) : entry.nativeName || entry.name || entry.id,
      value: entry.id
    }
  })
}
