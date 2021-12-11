import Vue from 'vue'
import VueI18n from 'vue-i18n'

Vue.use(VueI18n)

const messages = {
  zh: require('./zh.json'),
  en: require('./en.json')
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
  DEFAULT_LOCALE
}

export default i18n
