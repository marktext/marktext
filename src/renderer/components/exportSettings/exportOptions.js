import i18n from '../../../locales'

export const pageSizeList = [
  {
    label: `${i18n.t('dialogs.export.pageSizeList.A3')} (297mm x 420mm)`,
    value: 'A3'
  }, {
    label: `${i18n.t('dialogs.export.pageSizeList.A4')} (210mm x 297mm)`,
    value: 'A4'
  }, {
    label: `${i18n.t('dialogs.export.pageSizeList.A5')} (148mm x 210mm)`,
    value: 'A5'
  }, {
    label: `${i18n.t('dialogs.export.pageSizeList.USLegal')} (8.5" x 13")`,
    value: 'Legal'
  }, {
    label: `${i18n.t('dialogs.export.pageSizeList.USLetter')} (8.5" x 11")`,
    value: 'Letter'
  }, {
    label: `${i18n.t('dialogs.export.pageSizeList.Tabloid')} (17" x 11")`,
    value: 'Tabloid'
  }, {
    label: `${i18n.t('dialogs.export.pageSizeList.custom')}`,
    value: 'custom'
  }
]

export const headerFooterTypes = [
  {
    label: i18n.t('dialogs.export.headerAndFooter.types.none'),
    value: 0
  }, {
    label: i18n.t('dialogs.export.headerAndFooter.types.singleCell'),
    value: 1
  }, {
    label: i18n.t('dialogs.export.headerAndFooter.types.threeCells'),
    value: 2
  }
]

export const headerFooterStyles = [
  {
    label: i18n.t('dialogs.export.headerAndFooter.styles.default'),
    value: 0
  }, {
    label: i18n.t('dialogs.export.headerAndFooter.styles.simple'),
    value: 1
  }, {
    label: i18n.t('dialogs.export.headerAndFooter.styles.styled'),
    value: 2
  }
]

export const exportThemeList = [{
  label: 'Academic',
  value: 'academic'
}, {
  label: 'GitHub (Default)',
  value: 'default'
}, {
  label: 'Liber',
  value: 'liber'
}]
