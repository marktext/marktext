import type { IFileState } from '@shared/types/files'
import { wordCount as getWordCount } from '@muyajs/core'
import { getUniqueId, deepClone } from '../util'


export type IDocumentState = IFileState

export type { IFileState }

const defaultFileStateWithoutId = {
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

/** Template for per-tab state; callers assign the ID so every document receives a unique one. */
export const defaultFileState: Omit<IFileState, 'id'> = defaultFileStateWithoutId

export const getOptionsFromState = (
  file: IFileState
): {
  encoding: IFileState['encoding']
  lineEnding: IFileState['lineEnding']
  adjustLineEndingOnSave: boolean
  trimTrailingNewline: number
  isPendingCreation?: boolean
} => {
  const { encoding, lineEnding, adjustLineEndingOnSave, trimTrailingNewline } = file
  return {
    encoding,
    lineEnding,
    adjustLineEndingOnSave,
    trimTrailingNewline,
    isPendingCreation: file.isPendingCreation
  }
}

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

export const getBlankFileState = (
  tabs: Array<{ pathname: string; filename: string }>,
  defaultEncoding: string = defaultFileStateWithoutId.encoding.encoding,
  lineEnding: string = defaultFileStateWithoutId.lineEnding,
  markdown: string | null = defaultFileStateWithoutId.markdown
): IFileState => {
  const fileState = deepClone(defaultFileStateWithoutId) as Omit<IFileState, 'id'>
  const defaultFilenamePrefix = defaultFileStateWithoutId.filename.split('-')[0]
  const untitleId = Math.max(
    ...tabs.map((f) => {
      if (f.pathname === '') {
        return +f.filename.split('-')[1]
      } else {
        return 0
      }
    }),
    0
  )

  const id = getUniqueId()

  if (markdown == null) {
    markdown = defaultFileStateWithoutId.markdown
  }

  fileState.encoding.encoding = defaultEncoding
  return Object.assign(fileState, {
    lineEnding,
    adjustLineEndingOnSave: lineEnding.toLowerCase() === 'crlf',
    id,
    filename: `${defaultFilenamePrefix}-${untitleId + 1}`,
    markdown,
    wordCount: getWordCount(markdown),
    // The freshly-loaded document IS its on-disk/clean baseline. The engine
    // clears its undo history on `setContent`, so the baseline undo-stack depth
    // (the synthetic save-tracking id) is 0. Seeding `lastSavedHistoryId` to 0
    // (not -1) lets the dirty indicator clear again when an edit is undone back
    // to this baseline, even before the document has ever been saved.
    lastSavedHistoryId: 0
  }) as IFileState
}

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
  const docState = deepClone(defaultFileStateWithoutId) as Omit<IFileState, 'id'>

  for (const key of documentStateKeys) {
    if (src[key] !== undefined) {
      ;(docState as Record<string, unknown>)[key] = src[key]
    }
  }

  return Object.assign(docState, {
    id,
    // Read `src`: `docState.wordCount` defaults to a zeroed object, not a
    // sentinel, so it cannot say whether the caller supplied one.
    wordCount: src.wordCount ?? getWordCount(docState.markdown),
    // See `getBlankFileState`: the loaded document is its own clean baseline and
    // the engine's baseline undo-stack depth (the synthetic id) is 0.
    lastSavedHistoryId: 0
  }) as IFileState
}

export const getFileStateFromData = (
  data: Partial<IFileState> | Record<string, unknown> | null | undefined
): IFileState => createDocumentState(data)
