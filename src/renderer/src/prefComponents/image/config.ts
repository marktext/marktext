import { t } from '../../i18n'
import type { PrefSelectOption } from '../common/types'

export const getImageActions = (): PrefSelectOption<string>[] => [
  {
    label: t('preferences.image.actions.upload'),
    value: 'upload'
  },
  {
    label: t('preferences.image.actions.folder'),
    value: 'folder'
  },
  {
    label: t('preferences.image.actions.path'),
    value: 'path'
  }
]
