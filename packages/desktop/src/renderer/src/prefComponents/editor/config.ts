import { ENCODING_NAME_MAP } from 'common/encoding'
import { t } from '../../i18n'
import type { PrefSelectOption } from '../common/types'

export const getTabSizeOptions = (): PrefSelectOption<number | 'tab'>[] => [
  {
    label: t('preferences.markdown.lists.listIndentation.oneSpace'),
    value: 1
  },
  {
    label: t('preferences.markdown.lists.listIndentation.twoSpaces'),
    value: 2
  },
  {
    label: t('preferences.markdown.lists.listIndentation.threeSpaces'),
    value: 3
  },
  {
    label: t('preferences.markdown.lists.listIndentation.fourSpaces'),
    value: 4
  },
  {
    label: t('preferences.markdown.lists.listIndentation.tab'),
    value: 'tab'
  }
]

export const getEndOfLineOptions = (): PrefSelectOption<string>[] => [
  {
    label: t('preferences.editor.fileRepresentation.endOfLine.default'),
    value: 'default'
  },
  {
    label: t('preferences.editor.fileRepresentation.endOfLine.crlf'),
    value: 'crlf'
  },
  {
    label: t('preferences.editor.fileRepresentation.endOfLine.lf'),
    value: 'lf'
  }
]

export const getTrimTrailingNewlineOptions = (): PrefSelectOption<number>[] => [
  {
    label: t('preferences.editor.fileRepresentation.trailingNewlines.trimAll'),
    value: 0
  },
  {
    label: t('preferences.editor.fileRepresentation.trailingNewlines.ensureOne'),
    value: 1
  },
  {
    label: t('preferences.editor.fileRepresentation.trailingNewlines.preserve'),
    value: 2
  },
  {
    label: t('preferences.editor.fileRepresentation.trailingNewlines.doNothing'),
    value: 3
  }
]

export const getTextDirectionOptions = (): PrefSelectOption<string>[] => [
  {
    label: t('preferences.editor.misc.textDirection.ltr'),
    value: 'ltr'
  },
  {
    label: t('preferences.editor.misc.textDirection.rtl'),
    value: 'rtl'
  }
]

let defaultEncodingOptions: PrefSelectOption<string>[] | null = null
export const getDefaultEncodingOptions = (): PrefSelectOption<string>[] => {
  if (defaultEncodingOptions) {
    return defaultEncodingOptions
  }

  const options: PrefSelectOption<string>[] = []
  for (const [value, label] of Object.entries(ENCODING_NAME_MAP)) {
    options.push({ label, value })
  }
  defaultEncodingOptions = options
  return defaultEncodingOptions
}
