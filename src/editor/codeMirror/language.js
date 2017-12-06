import { CLASS_OR_ID } from '../config'
/**
 * check edit language
 */
export const checkEditLanguage = (paragraph, selectionState) => {
  const text = paragraph.textContent
  const { start } = selectionState
  const token = text.match(/(^`{3,})([^`]+)/)
  if (token) {
    const len = token[1].length
    const lang = token[2].trim()
    if (start < len) return false
    if (!lang) return false
    return lang
  } else {
    return false
  }
}

export const replaceLanguage = (paragraph, mode, selection) => {
  if (paragraph.tagName.toLowerCase() === 'input') {
    paragraph.value = mode
    return paragraph.focus()
  }
  paragraph.querySelector(`.${CLASS_OR_ID['AG_LANGUAGE']}`).textContent = mode
  const offset = paragraph.textContent.length
  selection.importSelection({
    start: offset,
    end: offset
  }, paragraph)
}
