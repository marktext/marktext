import Vue from 'vue'
import VueI18n from 'vue-i18n'

Vue.use(VueI18n)

const languageList = [
{
  name: 'English',
  id: 'en',
  message: require('./en.json')
}, {
  name: 'Chinese Simplified',
  id: 'zh',
  message: require('./zh.json')
}]

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
let currentLocale = 'zh' // TODO: Get it from Vue storage

// Create VueI18n instance with options
const i18n = new VueI18n({
  locale: currentLocale || DEFAULT_LOCALE, // set locale
  fallbackLocale: 'en',
  messages
})

export {
  messages,
  DEFAULT_LOCALE,
  languageOptions
}

export default i18n
