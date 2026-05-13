import GeneralIcon from '@/assets/icons/pref_general.svg'
import EditorIcon from '@/assets/icons/pref_editor.svg'
import MarkdownIcon from '@/assets/icons/pref_markdown.svg'
import ThemeIcon from '@/assets/icons/pref_theme.svg'
import ImageIcon from '@/assets/icons/pref_image.svg'
import SpellIcon from '@/assets/icons/pref_spellcheck.svg'
import KeyBindingIcon from '@/assets/icons/pref_key_binding.svg'

import preferences from '../../../../main/preferences/schema.json'
import { t } from '../../i18n'

export const getCategory = () => [
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

// Creates a reactive translated mapping function
export const getTranslatedSearchContent = () => {
  // Generate keys by iterating through each language
  const result = []
  Object.keys(preferences).forEach((k) => {
    const { description, enum: emums } = preferences[k]

    if (description.endsWith('--internal')) return

    let [category] = description.split('--')

    // Map category names
    let mappedCategory = category.toLowerCase()
    if (category === 'General') mappedCategory = 'general'
    else if (category === 'Editor') mappedCategory = 'editor'
    else if (category === 'Markdown') mappedCategory = 'markdown'
    else if (category === 'Theme') mappedCategory = 'theme'
    else if (category === 'Image') mappedCategory = 'image'
    else if (category === 'View') mappedCategory = 'view'
    else if (category === 'Searcher') mappedCategory = 'searcher'
    else if (category === 'Watcher') mappedCategory = 'watcher'
    else if (category === 'Spelling') mappedCategory = 'spelling'
    else if (category === 'Custom CSS') mappedCategory = 'custom css'
    else {
      // Handle special category names
      mappedCategory = category.toLowerCase().replace(/\s+/g, '-')
    }

    // Compute the category for route navigation (only allow existing routes, otherwise fall back to general)
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

    // Try to translate the category and item
    const categoryKey = `preferences.search.categories.${mappedCategory}`
    const itemKey = `preferences.search.items.${k}`

    // Translate the category name
    let translatedCategory = category
    const englishCategory = category
    try {
      translatedCategory = t(categoryKey)
    } catch (e) {
      console.warn(`   ⚠️ 搜索分类翻译失败: ${e.message}`)
      // Try fallback to preferences.categories
      try {
        const fallbackKey = `preferences.categories.${mappedCategory}`
        translatedCategory = t(fallbackKey)
      } catch (e2) {
        console.warn(`   ❌ 搜索分类fallback也失败: ${e2.message}`)
        translatedCategory = category
      }
    }

    // Translate preference description
    let translatedPreference = description.split('--')[1] || description
    const englishPreference = description.split('--')[1] || description
    try {
      translatedPreference = t(itemKey)
    } catch (e) {
      console.warn(`   ⚠️ 搜索项目翻译失败: ${e.message}`)
      // Try fallback to preferences.items
      try {
        const fallbackKey = `preferences.items.${k}`
        translatedPreference = t(fallbackKey)
      } catch (e2) {
        console.warn(`   ❌ 搜索项目fallback也失败: ${e2.message}`)
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
}

// Add language change listener
export const setupLanguageChangeListener = () => {
  // Listen for language change events
  const handleLanguageChange = () => {
    // Trigger search content refresh
    if (window.__VUE_I18N__) {
      try {
        const g =
          typeof window.__VUE_I18N__.global === 'function'
            ? window.__VUE_I18N__.global()
            : window.__VUE_I18N__.global
        const currentLanguage = g && g.locale ? g.locale.value || g.locale : 'en'

        // Here we can dispatch a custom event to notify the search component to refresh
        window.dispatchEvent(
          new CustomEvent('languageChanged', {
            detail: { language: currentLanguage }
          })
        )
      } catch (e) {
        console.warn('⚠️ 无法获取更新后的语言设置:', e)
      }
    }
  }

  // Listen for locale changes in the i18n instance
  if (window.__VUE_I18N__) {
    try {
      const i18n = window.__VUE_I18N__
      // Listen for locale changes
      const g = typeof i18n.global === 'function' ? i18n.global() : i18n.global
      if (g && g.locale && g.locale.value !== undefined) {
        // Use Vue's reactive system to listen for language changes
      }
    } catch (e) {
      console.warn('⚠️ 设置语言变化监听器失败:', e)
    }
  }

  // Add a polling fallback mechanism as a backup
  setInterval(() => {
    try {
      if (window.__VUE_I18N__) {
        const g =
          typeof window.__VUE_I18N__.global === 'function'
            ? window.__VUE_I18N__.global()
            : window.__VUE_I18N__.global
        const currentLanguage = g && g.locale ? g.locale.value || g.locale : 'en'
        if (currentLanguage !== getTranslatedSearchContent.lastLanguage) {
          getTranslatedSearchContent.lastLanguage = currentLanguage
          handleLanguageChange()
        }
      }
    } catch (e) {
      // Ignore errors and continue checking
    }
  }, 1000) // Check once per second

  // Record the initial language
  try {
    if (window.__VUE_I18N__) {
      const g =
        typeof window.__VUE_I18N__.global === 'function'
          ? window.__VUE_I18N__.global()
          : window.__VUE_I18N__.global
      getTranslatedSearchContent.lastLanguage = g && g.locale ? g.locale.value || g.locale : 'en'
    }
  } catch (e) {
    getTranslatedSearchContent.lastLanguage = 'en'
  }
}

// Initialize the language change listener
setupLanguageChangeListener()

// Add manual refresh function
export const refreshSearchContent = () => {
  // Clear the language cache to force re-fetch
  if (getTranslatedSearchContent.lastLanguage) {
    delete getTranslatedSearchContent.lastLanguage
  }

  // Trigger the language change event
  window.dispatchEvent(
    new CustomEvent('languageChanged', {
      detail: { language: 'force-refresh' }
    })
  )

  return getTranslatedSearchContent()
}

// Creates the debug popup (ensures the close button is visible)
function createDebugPopup() {
  // Remove any existing popup
  const existingPopup = document.getElementById('debugPopup')
  if (existingPopup) {
    document.body.removeChild(existingPopup)
  }

  // Create new popup
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

  // Create the title bar and close button
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
  title.textContent = '🛠️ 调试信息'
  title.style.cssText = 'margin: 0; color: #333;'

  const closeButton = document.createElement('button')
  closeButton.textContent = '✕ 关闭'
  closeButton.style.cssText = `
    background: #ff4444;
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
  `

  // Add close event
  closeButton.onclick = () => {
    if (popup && popup.parentNode) {
      popup.parentNode.removeChild(popup)
    }
  }

  // Assemble the title bar
  titleBar.appendChild(title)
  titleBar.appendChild(closeButton)

  // Create the content area
  const content = document.createElement('div')
  content.id = 'debugContent'

  // Assemble the popup
  popup.appendChild(titleBar)
  popup.appendChild(content)

  document.body.appendChild(popup)
  return popup
}

// General method to get the i18n instance (fixes API access issues)
function getI18nInstance() {
  if (!window.__VUE_I18N__) {
    return null
  }

  const i18n = window.__VUE_I18N__

  // Try different access methods
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

// Enhanced debug function (fixes API access issues)
export const debugLanguageState = () => {
  // Ensure the popup exists and is visible
  let popup = document.getElementById('debugPopup')
  if (!popup) {
    popup = createDebugPopup()
    popup.style.zIndex = '10000'
  }

  // Ensure the content area exists
  const debugContent = popup.querySelector('#debugContent')
  if (!debugContent) {
    const newContent = document.createElement('div')
    newContent.id = 'debugContent'
    popup.appendChild(newContent)
  }

  // Clear and populate debug information
  debugContent.innerHTML = '<div id="debugDetails">正在加载调试信息...</div>'

  // Populate debug details
  const details = debugContent.querySelector('#debugDetails')

  // Simulate delayed loading
  setTimeout(() => {
    try {
      // Show detailed information about the i18n instance
      let debugInfo = '<h4>🔍 i18n实例详细信息:</h4>'

      if (!window.__VUE_I18N__) {
        debugInfo += '<p style="color:red;">❌ __VUE_I18N__ 不存在</p>'
      } else {
        const i18n = window.__VUE_I18N__
        debugInfo += `
          <p><strong>__VUE_I18N__ 类型:</strong> ${typeof i18n}</p>
          <p><strong>__VUE_I18N__ 键:</strong> ${Object.keys(i18n).slice(0, 10).join(', ')}</p>
          <p><strong>global 类型:</strong> ${typeof i18n.global}</p>
        `

        // Safely display global info
        try {
          if (i18n.global) {
            const globalKeys = Object.keys(i18n.global).slice(0, 5)
            debugInfo += `<p><strong>global 键:</strong> ${globalKeys.join(', ')}</p>`

            // Check if translation function is available
            if (typeof i18n.global.t === 'function') {
              debugInfo += '<p style="color:green;">✅ global.t 函数可用</p>'
            } else {
              debugInfo += '<p style="color:orange;">⚠️ global.t 函数不可用</p>'
            }
          }
        } catch (e) {
          debugInfo += `<p style="color:red;">❌ 检查global时出错: ${e.message}</p>`
        }

        // Try to get the i18n instance
        const i18nInstance = getI18nInstance()
        if (i18nInstance) {
          debugInfo += '<p style="color:green;">✅ 成功获取i18n实例</p>'

          // Get the current language
          let currentLanguage = 'unknown'
          if (i18nInstance.locale && i18nInstance.locale.value) {
            currentLanguage = i18nInstance.locale.value
          } else if (i18nInstance.locale) {
            currentLanguage = i18nInstance.locale
          }

          debugInfo += `<p><strong>🌍 当前语言:</strong> ${currentLanguage}</p>`

          // Test translation
          try {
            const testTranslation = i18nInstance.t(
              'preferences.general.window.titleBarStyle.custom'
            )
            debugInfo += `<p><strong>🔄 测试翻译:</strong> ${testTranslation}</p>`
          } catch (e) {
            debugInfo += `<p style="color:red;"><strong>🔄 测试翻译失败:</strong> ${e.message}</p>`
          }
        } else {
          debugInfo += '<p style="color:red;">❌ 无法获取有效的i18n实例</p>'
        }
      }

      details.innerHTML = debugInfo
    } catch (e) {
      details.innerHTML = `<p style="color:red;">❌ 调试失败: ${e.message}</p>`
    }
  }, 500)
}
/*
// Add debug buttons to the page (visible in development environment only)
if (typeof document !== 'undefined') {
  const isDev = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) ||
    (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development');
  if (isDev) {
    // Ensure the button container exists
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'debugButtonContainer';
    buttonContainer.style.cssText = 'position:fixed;top:10px;right:10px;z-index:999;';

    // Create the debug button
    const debugButton = document.createElement('button');
    debugButton.textContent = '🛠️ Debug';
    debugButton.style.cssText = 'padding:8px 15px;margin:5px;background:#f0f0f0;border:1px solid #ddd;border-radius:4px;cursor:pointer;';
    debugButton.onclick = debugLanguageState;

    // Create the refresh button
    const refreshButton = document.createElement('button');
    refreshButton.textContent = '🔁 Refresh';
    refreshButton.style.cssText = 'padding:8px 15px;margin:5px;background:#f0f0f0;border:1px solid #ddd;border-radius:4px;cursor:pointer;';
    refreshButton.onclick = () => window.dispatchEvent(new CustomEvent('languageChanged'));

    // Add buttons to the container
    buttonContainer.appendChild(debugButton);
    buttonContainer.appendChild(refreshButton);

    // Add to document
    document.body.appendChild(buttonContainer);
  }
}
*/
