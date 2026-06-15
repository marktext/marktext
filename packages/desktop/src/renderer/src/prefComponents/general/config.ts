import { t } from '../../i18n'
import type { PrefSelectOption } from '../common/types'

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

export const getLanguageOptions = (): PrefSelectOption<string>[] => [
  {
    label: t('preferences.general.misc.language.english'),
    value: 'en'
  },
  {
    label: t('preferences.general.misc.language.chinese'),
    value: 'zh-CN'
  },
  {
    label: t('preferences.general.misc.language.traditionalChinese'),
    value: 'zh-TW'
  },
  {
    label: t('preferences.general.misc.language.spanish'),
    value: 'es'
  },
  {
    label: t('preferences.general.misc.language.french'),
    value: 'fr'
  },
  {
    label: t('preferences.general.misc.language.german'),
    value: 'de'
  },
  {
    label: t('preferences.general.misc.language.japanese'),
    value: 'ja'
  },
  {
    label: t('preferences.general.misc.language.korean'),
    value: 'ko'
  },
  {
    label: t('preferences.general.misc.language.portuguese'),
    value: 'pt'
  },
  {
    label: t('preferences.general.misc.language.turkish'),
    value: 'tr'
  }
]
