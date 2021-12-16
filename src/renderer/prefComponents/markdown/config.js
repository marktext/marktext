import i18n from '../../i18n'

export const bulletListMarkerOptions = () => {
  return [{
    label: '*',
    value: '*'
  }, {
    label: '-',
    value: '-'
  }, {
    label: '+',
    value: '+'
  }]
}

export const orderListDelimiterOptions = () => {
  return [{
    label: '.',
    value: '.'
  }, {
    label: ')',
    value: ')'
  }]
}

export const preferHeadingStyleOptions = () => {
  return [{
    label: i18n.t('preferences.markdown.preferHeadingStyle.atx'),
    value: 'atx'
  }, {
    label: i18n.t('preferences.markdown.preferHeadingStyle.setext'),
    value: 'setext'
  }]
}

export const tabSizeOptions = () => {
  return [{
    label: '1',
    value: 1
  }, {
    label: '2',
    value: 2
  }, {
    label: '3',
    value: 3
  }, {
    label: '4',
    value: 4
  }]
}

export const listIndentationOptions = () => {
  return [{
    label: i18n.t('preferences.markdown.listIndentation.dfm'),
    value: 'dfm'
  }, {
    label: i18n.t('preferences.markdown.listIndentation.tab'),
    value: 'tab'
  }, {
    label: i18n.t('preferences.markdown.listIndentation.singleSpace'),
    value: 1
  }, {
    label: i18n.t('preferences.markdown.listIndentation.twoSpaces'),
    value: 2
  }, {
    label: i18n.t('preferences.markdown.listIndentation.threeSpaces'),
    value: 3
  }, {
    label: i18n.t('preferences.markdown.listIndentation.fourSpaces'),
    value: 4
  }]
}

export const frontmatterTypeOptions = () => {
  return [{
    label: 'YAML',
    value: '-'
  }, {
    label: 'TOML',
    value: '+'
  }, {
    label: 'JSON (;;;)',
    value: ';'
  }, {
    label: 'JSON ({})',
    value: '{'
  }]
}

export const sequenceThemeOptions = () => {
  return [{
    label: i18n.t('preferences.markdown.sequenceTheme.hand'),
    value: 'hand'
  }, {
    label: i18n.t('preferences.markdown.sequenceTheme.simple'),
    value: 'simple'
  }]
}
