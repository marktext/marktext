import { getUniqueId } from '../util'

export const defaultFileState = {
  isSaved: true,
  pathname: '',
  filename: 'Untitled - unsaved',
  markdown: '',
  isUtf8BomEncoded: false,
  lineEnding: 'lf', // lf or crlf
  adjustLineEndingOnSave: false,
  cursor: {},
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
  }
}

export const getOptionsFromState = state => {
  const { isUtf8BomEncoded, lineEnding, adjustLineEndingOnSave } = state.currentFile
  return { isUtf8BomEncoded, lineEnding, adjustLineEndingOnSave }
}

export const getSingleFileState = ({ id = getUniqueId(), markdown, filename, pathname, options }) => {
  const fileState = JSON.parse(JSON.stringify(defaultFileState))
  const { isUtf8BomEncoded, lineEnding, adjustLineEndingOnSave } = options

  return Object.assign(fileState, {
    id,
    markdown,
    filename,
    pathname,
    isUtf8BomEncoded,
    lineEnding,
    adjustLineEndingOnSave
  })
}
