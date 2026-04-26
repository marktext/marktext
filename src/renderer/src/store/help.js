import { getUniqueId, deepClone } from '../util'

/**
 * Default internel markdown document with editor options.
 *
 * @type {IDocumentState} Internel markdown document
 */
export const defaultFileState = {
  // Indicates whether there are unsaved changes.
  isSaved: true,
  // Full path to the file or empty. If the value is empty the file doesn't exist on disk.
  pathname: '',
  filename: 'Untitled-1',
  markdown: '',
  encoding: {
    encoding: 'utf8',
    isBom: false
  },
  lineEnding: 'lf', // lf or crlf
  trimTrailingNewline: 3,
  adjustLineEndingOnSave: false, // convert editor buffer (LF) to CRLF when saving
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
  // Per tab notifications
  notifications: []
}

export const getOptionsFromState = (file) => {
  const { encoding, lineEnding, adjustLineEndingOnSave, trimTrailingNewline } = file
  return { encoding, lineEnding, adjustLineEndingOnSave, trimTrailingNewline }
}

const documentStateKeys = [
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
]

export const getBlankFileState = (
  tabs,
  defaultEncoding = defaultFileState.encoding.encoding,
  lineEnding = defaultFileState.lineEnding,
  markdown = defaultFileState.markdown
) => {
  const fileState = deepClone(defaultFileState)
  const defaultFilenamePrefix = defaultFileState.filename.split('-')[0]
  let untitleId = Math.max(
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

  // We may pass markdown=null as parameter.
  if (markdown == null) {
    markdown = defaultFileState.markdown
  }

  fileState.encoding.encoding = defaultEncoding
  return Object.assign(fileState, {
    lineEnding,
    adjustLineEndingOnSave: lineEnding.toLowerCase() === 'crlf',
    id,
    filename: `${defaultFilenamePrefix}-${++untitleId}`,
    markdown,
    lastSavedHistoryId: -1
  })
}

/**
 * Creates a internal document from the given document.
 *
 * @param {IMarkdownDocument} markdownDocument Markdown document
 * @param {String} [id] Random identifier
 * @returns {IDocumentState} Returns a document state
 */
export const createDocumentState = (markdownDocument = {}, id = getUniqueId()) => {
  markdownDocument = markdownDocument || {}
  const docState = deepClone(defaultFileState)

  for (const key of documentStateKeys) {
    if (markdownDocument[key] !== undefined) {
      docState[key] = markdownDocument[key]
    }
  }

  return Object.assign(docState, {
    id,
    lastSavedHistoryId: -1
  })
}

export const getFileStateFromData = (data) => createDocumentState(data)
