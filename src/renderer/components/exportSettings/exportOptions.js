export const getPageSizeList = (t) => [
  {
    label: t('export.pageSize.A3'),
    value: 'A3'
  }, {
    label: t('export.pageSize.A4'),
    value: 'A4'
  }, {
    label: t('export.pageSize.A5'),
    value: 'A5'
  }, {
    label: t('export.pageSize.Legal'),
    value: 'Legal'
  }, {
    label: t('export.pageSize.Letter'),
    value: 'Letter'
  }, {
    label: t('export.pageSize.Tabloid'),
    value: 'Tabloid'
  }, {
    label: t('export.pageSize.Custom'),
    value: 'custom'
  }
]

export const getHeaderFooterTypes = (t) => [
  {
    label: t('export.headerFooterType.none'),
    value: 0
  }, {
    label: t('export.headerFooterType.singleCell'),
    value: 1
  }, {
    label: t('export.headerFooterType.threeCells'),
    value: 2
  }
]

export const getHeaderFooterStyles = (t) => [
  {
    label: t('export.headerFooterStyle.default'),
    value: 0
  }, {
    label: t('export.headerFooterStyle.simple'),
    value: 1
  }, {
    label: t('export.headerFooterStyle.styled'),
    value: 2
  }
]

export const getExportThemeList = (t) => [{
  label: t('export.theme.academic'),
  value: 'academic'
}, {
  label: t('export.theme.github'),
  value: 'default'
}, {
  label: t('export.theme.liber'),
  value: 'liber'
}]
