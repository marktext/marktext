import components from 'prismjs/components.js'
import getLoader from 'prismjs/dependencies'
import { getDefer } from '../utils'
/**
 * The set of all languages which have been loaded using the below function.
 *
 * @type {Set<string>}
 */
export const loadedLanguages = new Set(['markup', 'css', 'clike', 'javascript'])

const { languages } = components

// Skip eager glob discovery under Vitest: the test runner resolves all matched
// files synchronously, which causes prism component files (e.g. prism-cpp.js)
// to load before their `require` dependencies (e.g. prism-c.js) are registered.
const prismJsComponents = (typeof process !== 'undefined' && process.env.VITEST)
  ? {}
  : import.meta.glob('../../../../node_modules/prismjs/components/*.js')
// Look for the origin languge by alias
export const transformAliasToOrigin = (langs) => {
  const result = []
  for (const lang of langs) {
    if (languages[lang]) {
      result.push(lang)
    } else {
      const language = Object.keys(languages).find((name) => {
        const l = languages[name]
        if (l.alias) {
          return l.alias === lang || (Array.isArray(l.alias) && l.alias.includes(lang))
        }
        return false
      })

      if (language) {
        result.push(language)
      } else {
        // The lang is not exist, the will handle in `initLoadLanguage`
        result.push(lang)
      }
    }
  }

  return result
}

function initLoadLanguage(Prism) {
  return async function loadLanguages(langs) {
    // If no argument is passed, load all components
    if (!langs) {
      langs = Object.keys(languages).filter((lang) => lang !== 'meta')
    }

    if (langs && !langs.length) {
      return Promise.reject(
        new Error('The first parameter should be a list of load languages or single language.')
      )
    }

    if (!Array.isArray(langs)) {
      langs = [langs]
    }

    const promises = []
    // The user might have loaded languages via some other way or used `prism.js` which already includes some
    // We don't need to validate the ids because `getLoader` will ignore invalid ones
    const loaded = [...loadedLanguages, ...Object.keys(Prism.languages)]

    getLoader(components, langs, loaded).load(async(lang) => {
      const defer = getDefer()
      promises.push(defer.promise)
      if (!(lang in components.languages)) {
        defer.resolve({
          lang,
          status: 'noexist'
        })
      } else if (loadedLanguages.has(lang)) {
        defer.resolve({
          lang,
          status: 'cached'
        })
      } else {
        const loaderName = `../../../../node_modules/prismjs/components/prism-${lang}.js`
        const loader = prismJsComponents[loaderName]
        if (!loader) {
          // No loader available (e.g. eager glob disabled under Vitest, or the
          // matched file is missing). Don't mutate Prism state or mark the
          // language as loaded — leave it for a future, working attempt.
          defer.resolve({
            lang,
            status: 'noexist'
          })
          return
        }
        delete Prism.languages[lang]
        await loader()
        defer.resolve({
          lang,
          status: 'loaded'
        })
        loadedLanguages.add(lang)
      }
    })

    return Promise.all(promises)
  }
}

export default initLoadLanguage
