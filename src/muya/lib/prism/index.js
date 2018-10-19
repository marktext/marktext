import Prism from 'prismjs'
import { filter } from 'fuzzaldrin'
import initLoadLanguage from './loadLanguage'
import languages from './languages'

const prism = Prism
const langs = Object.keys(languages).map(name => (languages[name]))
const loadLanguage = initLoadLanguage(Prism)

/**
 * check edit language
 */
const checkEditLanguage = (paragraph, selectionState) => {
  const text = paragraph.textContent
  const { start } = selectionState
  const token = text.match(/(^`{3,})([^`]+)/)

  if (token) {
    const len = token[1].length
    const lang = token[2].trim()
    if (start < len) return false
    if (!lang) return false
    return lang
  } else if (paragraph.classList.contains('ag-language-input')) {
    return text.trim()
  } else {
    return false
  }
}

const search = text => {
  return filter(langs, text, { key: 'name' })
}

export {
  search,
  loadLanguage,
  languages,
  checkEditLanguage
}

export default prism
