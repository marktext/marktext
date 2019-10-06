import { ENCODING_NAME_MAP } from 'common/encoding'

export const endOfLineOptions = [{
  label: 'Default',
  value: 'default'
}, {
  label: 'Carriage return and Line feed(CRLF)',
  value: 'crlf'
}, {
  label: 'Line feed(Lf)',
  value: 'lf'
}]

export const textDirectionOptions = [{
  label: 'Left to Right',
  value: 'ltr'
}, {
  label: 'Right to Left',
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
