import {
  Setting as GeneralIcon,
  Edit as EditorIcon,
  Document as MarkdownIcon,
  Brush as ThemeIcon,
  Picture as ImageIcon,
  Reading as SpellIcon,
  Operation as KeyBindingIcon
} from '@element-plus/icons-vue'

import preferences from '../../../../main/preferences/schema.json'
import { t } from '../../i18n'

interface PrefCategory {
  name: string
  label: string
  icon: unknown
  path: string
}

interface PreferenceSchemaEntry {
  description: string
  enum?: unknown[]
  [key: string]: unknown
}

interface TranslatedSearchEntry {
  key: string
  category: string
  categoryEn: string
  preference: string
  preferenceEn: string
  routeCategory: string
  description: string
  enum: unknown[] | undefined
}

interface VueI18nLocale {
  value?: string
}

interface VueI18nGlobal {
  locale?: VueI18nLocale | string
  t?: (key: string) => string
}

interface VueI18nGlobalContainer {
  global?: VueI18nGlobal | (() => VueI18nGlobal)
  t?: (key: string) => string
  $i18n?: VueI18nGlobal
}

declare global {
  interface Window {
    __VUE_I18N__?: VueI18nGlobalContainer
  }
}

// Function-attached cache shared between getTranslatedSearchContent and
// setupLanguageChangeListener.
interface CachedTranslator {
  (): TranslatedSearchEntry[]
  lastLanguage?: string
}

const preferencesSchema = preferences as unknown as Record<string, PreferenceSchemaEntry>

export const getCategory = (): PrefCategory[] => [
  {
    name: t('preferences.categories.general'),
    label: 'general',
    icon: GeneralIcon,
    path: '/preference/general'
  },
  {
    name: t('preferences.categories.editor'),
    label: 'editor',
    icon: EditorIcon,
    path: '/preference/editor'
  },
  {
    name: t('preferences.categories.markdown'),
    label: 'markdown',
    icon: MarkdownIcon,
    path: '/preference/markdown'
  },
  {
    name: t('preferences.categories.spelling'),
    label: 'spelling',
    icon: SpellIcon,
    path: '/preference/spelling'
  },
  {
    name: t('preferences.categories.theme'),
    label: 'theme',
    icon: ThemeIcon,
    path: '/preference/theme'
  },
  {
    name: t('preferences.categories.image'),
    label: 'image',
    icon: ImageIcon,
    path: '/preference/image'
  },
  {
    name: t('preferences.categories.keybindings'),
    label: 'keybindings',
    icon: KeyBindingIcon,
    path: '/preference/keybindings'
  }
]

const errMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e))

const resolveGlobal = (container: VueI18nGlobalContainer | undefined): VueI18nGlobal | undefined => {
  if (!container) return undefined
  return typeof container.global === 'function' ? container.global() : container.global
}

const resolveLocale = (g: VueI18nGlobal | undefined): string => {
  if (!g || !g.locale) return 'en'
  if (typeof g.locale === 'string') return g.locale
  return g.locale.value ?? 'en'
}

export const getTranslatedSearchContent: CachedTranslator = (() => {
  const fn = (() => {
    const result: TranslatedSearchEntry[] = []
    Object.keys(preferencesSchema).forEach((k) => {
      const entry = preferencesSchema[k]
      if (!entry) return
      const { description, enum: emums } = entry

      if (description.endsWith('--internal')) return

      const [category] = description.split('--')
      const categoryName = category ?? ''

      let mappedCategory: string
      if (categoryName === 'General') mappedCategory = 'general'
      else if (categoryName === 'Editor') mappedCategory = 'editor'
      else if (categoryName === 'Markdown') mappedCategory = 'markdown'
      else if (categoryName === 'Theme') mappedCategory = 'theme'
      else if (categoryName === 'Image') mappedCategory = 'image'
      else if (categoryName === 'View') mappedCategory = 'view'
      else if (categoryName === 'Searcher') mappedCategory = 'searcher'
      else if (categoryName === 'Watcher') mappedCategory = 'watcher'
      else if (categoryName === 'Spelling') mappedCategory = 'spelling'
      else if (categoryName === 'Custom CSS') mappedCategory = 'custom css'
      else {
        mappedCategory = categoryName.toLowerCase().replace(/\s+/g, '-')
      }

      let routeCategory = mappedCategory
      const validRoutes = [
        'general',
        'editor',
        'markdown',
        'spelling',
        'theme',
        'image',
        'keybindings'
      ]
      if (!validRoutes.includes(routeCategory)) routeCategory = 'general'

      const categoryKey = `preferences.search.categories.${mappedCategory}`
      const itemKey = `preferences.search.items.${k}`

      let translatedCategory: string
      const englishCategory = categoryName
      try {
        translatedCategory = t(categoryKey)
      } catch (e) {
        console.warn(`   ⚠️ Search category translation failed: ${errMessage(e)}`)
        try {
          const fallbackKey = `preferences.categories.${mappedCategory}`
          translatedCategory = t(fallbackKey)
        } catch (e2) {
          console.warn(`   ❌ Search category fallback also failed: ${errMessage(e2)}`)
          translatedCategory = categoryName
        }
      }

      let translatedPreference: string
      const englishPreference = description.split('--')[1] || description
      try {
        translatedPreference = t(itemKey)
      } catch (e) {
        console.warn(`   ⚠️ Search item translation failed: ${errMessage(e)}`)
        try {
          const fallbackKey = `preferences.items.${k}`
          translatedPreference = t(fallbackKey)
        } catch (e2) {
          console.warn(`   ❌ Search item fallback also failed: ${errMessage(e2)}`)
          translatedPreference = description.split('--')[1] || description
        }
      }

      result.push({
        key: k,
        category: translatedCategory,
        categoryEn: englishCategory,
        preference: translatedPreference,
        preferenceEn: englishPreference,
        routeCategory,
        description,
        enum: emums
      })
    })
    return result
  }) as CachedTranslator
  return fn
})()

export const setupLanguageChangeListener = (): void => {
  const handleLanguageChange = () => {
    if (window.__VUE_I18N__) {
      try {
        const g = resolveGlobal(window.__VUE_I18N__)
        const currentLanguage = resolveLocale(g)

        window.dispatchEvent(
          new CustomEvent('languageChanged', {
            detail: { language: currentLanguage }
          })
        )
      } catch (e) {
        console.warn('⚠️ Failed to get updated language setting:', e)
      }
    }
  }

  if (window.__VUE_I18N__) {
    try {
      const g = resolveGlobal(window.__VUE_I18N__)
      if (g && g.locale && typeof g.locale !== 'string' && g.locale.value !== undefined) {
        // Locale changes are polled below.
      }
    } catch (e) {
      console.warn('⚠️ Failed to set up language change listener:', e)
    }
  }

  setInterval(() => {
    try {
      if (window.__VUE_I18N__) {
        const g = resolveGlobal(window.__VUE_I18N__)
        const currentLanguage = resolveLocale(g)
        if (currentLanguage !== getTranslatedSearchContent.lastLanguage) {
          getTranslatedSearchContent.lastLanguage = currentLanguage
          handleLanguageChange()
        }
      }
    } catch {
      // Ignore errors and continue checking
    }
  }, 1000)

  try {
    if (window.__VUE_I18N__) {
      const g = resolveGlobal(window.__VUE_I18N__)
      getTranslatedSearchContent.lastLanguage = resolveLocale(g)
    }
  } catch {
    getTranslatedSearchContent.lastLanguage = 'en'
  }
}

setupLanguageChangeListener()

export const refreshSearchContent = (): TranslatedSearchEntry[] => {
  if (getTranslatedSearchContent.lastLanguage) {
    delete getTranslatedSearchContent.lastLanguage
  }

  window.dispatchEvent(
    new CustomEvent('languageChanged', {
      detail: { language: 'force-refresh' }
    })
  )

  return getTranslatedSearchContent()
}

function createDebugPopup(): HTMLDivElement {
  const existingPopup = document.getElementById('debugPopup')
  if (existingPopup && existingPopup.parentNode) {
    existingPopup.parentNode.removeChild(existingPopup)
  }

  const popup = document.createElement('div')
  popup.id = 'debugPopup'
  popup.style.cssText = `
    position: fixed;
    top: 50px;
    right: 20px;
    width: 400px;
    height: 300px;
    background: white;
    border: 2px solid #333;
    padding: 15px;
    overflow: auto;
    z-index: 10000;
    box-shadow: 0 0 10px rgba(0,0,0,0.2);
  `

  const titleBar = document.createElement('div')
  titleBar.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    border-bottom: 1px solid #ccc;
    padding-bottom: 10px;
  `

  const title = document.createElement('h3')
  title.textContent = '🛠️ Debug Info'
  title.style.cssText = 'margin: 0; color: #333;'

  const closeButton = document.createElement('button')
  closeButton.textContent = '✕ Close'
  closeButton.style.cssText = `
    background: #ff4444;
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
  `

  closeButton.onclick = () => {
    if (popup && popup.parentNode) {
      popup.parentNode.removeChild(popup)
    }
  }

  titleBar.appendChild(title)
  titleBar.appendChild(closeButton)

  const content = document.createElement('div')
  content.id = 'debugContent'

  popup.appendChild(titleBar)
  popup.appendChild(content)

  document.body.appendChild(popup)
  return popup
}

function getI18nInstance(): VueI18nGlobal | VueI18nGlobalContainer | null {
  if (!window.__VUE_I18N__) {
    return null
  }

  const i18n = window.__VUE_I18N__

  if (typeof i18n.global === 'function') {
    return i18n.global()
  } else if (i18n.global && typeof i18n.global.t === 'function') {
    return i18n.global
  } else if (typeof i18n.t === 'function') {
    return i18n
  } else if (i18n.$i18n && typeof i18n.$i18n.t === 'function') {
    return i18n.$i18n
  }

  return null
}

export const debugLanguageState = (): void => {
  let popup = document.getElementById('debugPopup') as HTMLDivElement | null
  if (!popup) {
    popup = createDebugPopup()
    popup.style.zIndex = '10000'
  }

  let debugContent = popup.querySelector('#debugContent') as HTMLDivElement | null
  if (!debugContent) {
    const newContent = document.createElement('div')
    newContent.id = 'debugContent'
    popup.appendChild(newContent)
    debugContent = newContent
  }

  debugContent.innerHTML = '<div id="debugDetails">Loading debug info...</div>'

  const details = debugContent.querySelector('#debugDetails') as HTMLDivElement | null
  if (!details) return

  setTimeout(() => {
    try {
      let debugInfo = '<h4>🔍 i18n instance details:</h4>'

      if (!window.__VUE_I18N__) {
        debugInfo += '<p style="color:red;">❌ __VUE_I18N__ does not exist</p>'
      } else {
        const i18n = window.__VUE_I18N__
        debugInfo += `
          <p><strong>__VUE_I18N__ type:</strong> ${typeof i18n}</p>
          <p><strong>__VUE_I18N__ keys:</strong> ${Object.keys(i18n).slice(0, 10).join(', ')}</p>
          <p><strong>global type:</strong> ${typeof i18n.global}</p>
        `

        try {
          if (i18n.global) {
            const globalKeys = Object.keys(i18n.global).slice(0, 5)
            debugInfo += `<p><strong>global keys:</strong> ${globalKeys.join(', ')}</p>`

            if (typeof (i18n.global as VueI18nGlobal).t === 'function') {
              debugInfo += '<p style="color:green;">✅ global.t function available</p>'
            } else {
              debugInfo += '<p style="color:orange;">⚠️ global.t function unavailable</p>'
            }
          }
        } catch (e) {
          debugInfo += `<p style="color:red;">❌ Error checking global: ${errMessage(e)}</p>`
        }

        const i18nInstance = getI18nInstance()
        if (i18nInstance) {
          debugInfo += '<p style="color:green;">✅ Successfully got i18n instance</p>'

          let currentLanguage = 'unknown'
          const inst = i18nInstance as VueI18nGlobal
          if (inst.locale && typeof inst.locale !== 'string' && inst.locale.value) {
            currentLanguage = inst.locale.value
          } else if (typeof inst.locale === 'string') {
            currentLanguage = inst.locale
          }

          debugInfo += `<p><strong>🌍 Current language:</strong> ${currentLanguage}</p>`

          try {
            const tFn = (i18nInstance as VueI18nGlobal).t
            const testTranslation = tFn
              ? tFn('preferences.general.window.titleBarStyle.custom')
              : ''
            debugInfo += `<p><strong>🔄 Test translation:</strong> ${testTranslation}</p>`
          } catch (e) {
            debugInfo += `<p style="color:red;"><strong>🔄 Test translation failed:</strong> ${errMessage(e)}</p>`
          }
        } else {
          debugInfo += '<p style="color:red;">❌ Could not get a valid i18n instance</p>'
        }
      }

      details.innerHTML = debugInfo
    } catch (e) {
      details.innerHTML = `<p style="color:red;">❌ Debug failed: ${errMessage(e)}</p>`
    }
  }, 500)
}
