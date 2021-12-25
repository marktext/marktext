import i18n from '../../i18n'

export const titleBarStyleOptions = () => {
  return [{
    label: i18n.t('preferences.general.titleBarStyle.custom'),
    value: 'custom'
  }, {
    label: i18n.t('preferences.general.titleBarStyle.native'),
    value: 'native'
  }]
}

export const fileSortByOptions = () => {
  return [{
    label: i18n.t('preferences.general.fileSortBy.created'),
    value: 'created'
  }, {
    label: i18n.t('preferences.general.fileSortBy.modified'),
    value: 'modified'
  }, {
    label: i18n.t('preferences.general.fileSortBy.title'),
    value: 'title'
  }]
}
