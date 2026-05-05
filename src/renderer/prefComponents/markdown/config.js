export const bulletListMarkerOptions = (t) => [{
  label: t('pref.markdown.bulletListMarker.asterisk'),
  value: '*'
}, {
  label: t('pref.markdown.bulletListMarker.dash'),
  value: '-'
}, {
  label: t('pref.markdown.bulletListMarker.plus'),
  value: '+'
}]

export const orderListDelimiterOptions = (t) => [{
  label: t('pref.markdown.orderListDelimiter.dot'),
  value: '.'
}, {
  label: t('pref.markdown.orderListDelimiter.paren'),
  value: ')'
}]

export const preferHeadingStyleOptions = (t) => [{
  label: t('pref.markdown.headingStyle.atx'),
  value: 'atx'
}, {
  label: t('pref.markdown.headingStyle.setext'),
  value: 'setext'
}]

export const listIndentationOptions = (t) => [{
  label: t('pref.markdown.listIndentation.docfx'),
  value: 'dfm'
}, {
  label: t('pref.markdown.listIndentation.tab'),
  value: 'tab'
}, {
  label: t('pref.markdown.listIndentation.space1'),
  value: 1
}, {
  label: t('pref.markdown.listIndentation.space2'),
  value: 2
}, {
  label: t('pref.markdown.listIndentation.space3'),
  value: 3
}, {
  label: t('pref.markdown.listIndentation.space4'),
  value: 4
}]

export const frontmatterTypeOptions = (t) => [{
  label: t('pref.markdown.frontMatter.yaml'),
  value: '-'
}, {
  label: t('pref.markdown.frontMatter.toml'),
  value: '+'
}, {
  label: t('pref.markdown.frontMatter.jsonSemi'),
  value: ';'
}, {
  label: t('pref.markdown.frontMatter.jsonBrace'),
  value: '{'
}]

export const sequenceThemeOptions = (t) => [{
  label: t('pref.markdown.sequenceTheme.hand'),
  value: 'hand'
}, {
  label: t('pref.markdown.sequenceTheme.simple'),
  value: 'simple'
}]
