import { ENCODING_NAME_MAP } from 'common/encoding'

export const tabSizeOptions = [{
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

export const endOfLineOptions = (t) => [{
  label: t('pref.editor.lineSeparator.default'),
  value: 'default'
}, {
  label: t('pref.editor.lineSeparator.crlf'),
  value: 'crlf'
}, {
  label: t('pref.editor.lineSeparator.lf'),
  value: 'lf'
}]

export const trimTrailingNewlineOptions = (t) => [{
  label: t('pref.editor.trailingNewline.trimAll'),
  value: 0
}, {
  label: t('pref.editor.trailingNewline.ensureOne'),
  value: 1
}, {
  label: t('pref.editor.trailingNewline.preserveOriginal'),
  value: 2
}, {
  label: t('pref.editor.trailingNewline.doNothing'),
  value: 3
}]

export const textDirectionOptions = (t) => [{
  label: t('pref.editor.textDirection.ltr'),
  value: 'ltr'
}, {
  label: t('pref.editor.textDirection.rtl'),
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
