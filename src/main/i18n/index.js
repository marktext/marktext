import Vue from 'vue'
import VueI18n from 'vue-i18n'
import { messages, DEFAULT_LOCALE } from '../../locales'

Vue.use(VueI18n)

let currentLocale = 'zh' // TODO: Get it from Vue storage

// Create VueI18n instance with options
const i18n = new VueI18n({
  locale: currentLocale || DEFAULT_LOCALE, // set locale
  fallbackLocale: 'en',
  messages
})

export default i18n
