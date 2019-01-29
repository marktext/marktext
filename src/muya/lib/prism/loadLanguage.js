import languages from './languages'
let peerDependentsMap = null
export const loadedCache = new Set(['markup', 'css', 'clike', 'javascript'])

function getPeerDependentsMap () {
  const peerDependentsMap = {}
  Object.keys(languages).forEach(function (language) {
    if (language === 'meta') {
      return false
    }
    if (languages[language].peerDependencies) {
      let peerDependencies = languages[language].peerDependencies
      if (!Array.isArray(peerDependencies)) {
        peerDependencies = [peerDependencies]
      }
      peerDependencies.forEach(function (peerDependency) {
        if (!peerDependentsMap[peerDependency]) {
          peerDependentsMap[peerDependency] = []
        }
        peerDependentsMap[peerDependency].push(language)
      })
    }
  })
  return peerDependentsMap
}

function getPeerDependents (mainLanguage) {
  if (!peerDependentsMap) {
    peerDependentsMap = getPeerDependentsMap()
  }
  return peerDependentsMap[mainLanguage] || []
}

function initLoadLanguage (Prism) {
  return function loadLanguages (arr, withoutDependencies) {
    // If no argument is passed, load all components
    if (!arr) {
      arr = Object.keys(languages).filter(function (language) {
        return language !== 'meta'
      })
    }
    if (arr && !arr.length) {
      return
    }

    if (!Array.isArray(arr)) {
      arr = [arr]
    }

    arr.forEach(function (language) {
      if (!languages[language]) {
        console.warn('Language does not exist ' + language)
        return
      }
      if (loadedCache.has(language)) {
        return
      }

      // Load dependencies first
      if (!withoutDependencies && languages[language].require) {
        loadLanguages(languages[language].require)
      }

      delete Prism.languages[language]
      import('prismjs2/components/prism-' + language)
        .then(_ => {
          loadedCache.add(language)
        })

      // Reload dependents
      const dependents = getPeerDependents(language).filter(function (dependent) {
        // If dependent language was already loaded,
        // we want to reload it.
        if (Prism.languages[dependent]) {
          delete Prism.languages[dependent]
          return true
        }
        return false
      })
      if (dependents.length) {
        loadLanguages(dependents, true)
      }
    })
  }
}

export default initLoadLanguage
