import Prism from 'prismjs'
import { filter } from 'fuzzaldrin'
import initLoadLanguage, { loadedCache, transfromAliasToOrigin } from './loadLanguage'
import languages from './languages'

const prism = Prism
window.Prism = Prism
import('prismjs/plugins/keep-markup/prism-keep-markup')

const langs = []

for (const name of Object.keys(languages)) {
  const lang = languages[name]
  langs.push({
    name,
    ...lang
  })
  if (lang.alias) {
    if (typeof lang.alias === 'string') {
      langs.push({
        name: lang.alias,
        ...lang
      })
    } else if (Array.isArray(lang.alias)) {
      langs.push(...lang.alias.map(a => ({
        name: a,
        ...lang
      })))
    }
  }
}

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
  transfromAliasToOrigin,
  languages
}

export default prism
