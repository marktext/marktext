import Vue from 'vue'
import VueI18n from 'vue-i18n'
import languageList from './language-list'

Vue.use(VueI18n)

let messages = {}
let languageOptions = []

for (let i = 0; i < languageList.length; i++) {
  messages[languageList[i].id] = languageList[i].message
  languageOptions.push({
    label: languageList[i].name,
    value: languageList[i].id
  })
}

const DEFAULT_LOCALE = 'en'

// Create VueI18n instance with options
const i18n = new VueI18n({
  locale: DEFAULT_LOCALE, // set locale
  fallbackLocale: 'en',
  messages
})

export {
  messages,
  DEFAULT_LOCALE,
  languageOptions
}

export default i18n
