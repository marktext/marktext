import Prism from 'prismjs2'
import { filter } from 'fuzzaldrin'
import initLoadLanguage, { loadedCache } from './loadLanguage'
import languages from './languages'

const prism = Prism
window.Prism = Prism
import('prismjs2/plugins/keep-markup/prism-keep-markup')
const langs = Object.keys(languages).map(name => (languages[name]))
const loadLanguage = initLoadLanguage(Prism)

/**
 * check edit language
 */
const checkEditLanguage = (paragraph, selectionState) => {
  const text = paragraph.textContent
  const { start } = selectionState
  const token = text.match(/(^`{3,})([^`]+)/)
  if (paragraph.tagName !== 'SPAN') return false
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

// pre load latex and yaml and html for `math block` \ `front matter` and `html block`
loadLanguage('latex')
loadLanguage('yaml')

export {
  search,
  loadLanguage,
  loadedCache,
  languages,
  checkEditLanguage
}

export default prism
