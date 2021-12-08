import { ENCODING_NAME_MAP } from 'common/encoding'
import i18n from '../../i18n'

export const endOfLineOptions = [{
  label: i18n.t('preferences.editor.endOfLine.default'),
  value: 'default'
}, {
  label: i18n.t('preferences.editor.endOfLine.crlf'),
  value: 'crlf'
}, {
  label: i18n.t('preferences.editor.endOfLine.lf'),
  value: 'lf'
}]

export const trimTrailingNewlineOptions = [{
  label: i18n.t('preferences.editor.trimTrailingNewline.all'),
  value: 0
}, {
  label: i18n.t('preferences.editor.trimTrailingNewline.exactlyOne'),
  value: 1
}, {
  label: i18n.t('preferences.editor.trimTrailingNewline.originalStyle'),
  value: 2
}, {
  label: i18n.t('preferences.editor.trimTrailingNewline.doNothing'),
  value: 3
}]

export const textDirectionOptions = [{
  label: i18n.t('preferences.editor.textDirection.ltr'),
  value: 'ltr'
}, {
  label: i18n.t('preferences.editor.textDirection.rtl'),
  value: 'rtl'
}]

let defaultEncodingOptions = null
export const getDefaultEncodingOptions = () => {
  if (defaultEncodingOptions) {
    return defaultEncodingOptions
  }

  defaultEncodingOptions = []
  for (const [value, label] of Object.entries(ENCODING_NAME_MAP)) {
    defaultEncodingOptions.push({ label, value })
  }
  return defaultEncodingOptions
}
