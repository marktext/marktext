import type { IFileState, SaveFormatState } from '@shared/types/files'
import { wordCount as getWordCount } from '@muyajs/core'
import { getUniqueId, deepClone } from '../util'

const defaultFileState = {
  readOnly: false,
  isPreview: false,
  isSaved: true,
  pathname: '',
  filename: 'Untitled-1',
  markdown: '',
  encoding: {
    encoding: 'utf8',
    isBom: false
  },
  lineEnding: 'lf',
  trimTrailingNewline: 3,
  adjustLineEndingOnSave: false,
  history: {
    stack: [],
    index: -1
  },
  cursor: null,
  wordCount: {
    paragraph: 0,
    word: 0,
    character: 0,
    all: 0
  },
  searchMatches: {
    index: -1,
    matches: [],
    value: ''
  },
  scrollTop: 0,
  muyaIndexCursor: null,
  notifications: []
} satisfies Omit<IFileState, 'id'>

export const getOptionsFromState = (file: IFileState): SaveFormatState => ({
  encoding: { ...file.encoding },
  lineEnding: file.lineEnding === 'crlf' ? 'crlf' : 'lf',
  adjustLineEndingOnSave: file.adjustLineEndingOnSave,
  trimTrailingNewline: file.trimTrailingNewline as SaveFormatState['trimTrailingNewline']
})

const documentStateKeys = [
  'readOnly',
  'diskMissing',
  'diskConflict',
  'isPendingCreation',
  'isSaved',
  'pathname',
  'filename',
  'markdown',
  'encoding',
  'lineEnding',
  'trimTrailingNewline',
  'adjustLineEndingOnSave',
  'history',
  'cursor',
  'wordCount',
  'searchMatches',
  'scrollTop',
  'muyaIndexCursor',
  'notifications'
] as const satisfies ReadonlyArray<keyof IFileState>

/**
 * Creates an internal document from the given document. Accepts loosely
 * typed input (IPC payloads, partial states) and copies through the keys
 * documented by `documentStateKeys`.
 */
export const createDocumentState = (
  markdownDocument: Partial<IFileState> | Record<string, unknown> | null | undefined = {},
  id: string = getUniqueId()
): IFileState => {
  const src = (markdownDocument || {}) as Record<string, unknown>
  const docState = deepClone(defaultFileState) as Omit<IFileState, 'id'>

  for (const key of documentStateKeys) {
    if (src[key] !== undefined) {
      ;(docState as Record<string, unknown>)[key] = src[key]
    }
  }

  return Object.assign(docState, {
    id,
    // A zeroed default cannot distinguish an omitted count from a supplied one.
    wordCount: src.wordCount ?? getWordCount(docState.markdown)
  }) as IFileState
}
