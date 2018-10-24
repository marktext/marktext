import Prism from 'prismjs2'
import { filter } from 'fuzzaldrin'
import initLoadLanguage, { loadedCache } from './loadLanguage'
import languages from './languages'

const prism = Prism
window.Prism = Prism
import('prismjs2/plugins/keep-markup/prism-keep-markup')
const langs = Object.keys(languages).map(name => (languages[name]))
const loadLanguage = initLoadLanguage(Prism)

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
  languages
}

export default prism
