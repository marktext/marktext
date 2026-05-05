import Vue from 'vue'
import VueI18n from 'vue-i18n'
import { ipcRenderer } from 'electron'
import locale from 'element-ui/lib/locale'
import enElementLocale from 'element-ui/lib/locale/lang/en'
import zhElementLocale from 'element-ui/lib/locale/lang/zh-CN'
import enUS from './locales/en-US.json'

Vue.use(VueI18n)

const elementLocales = {
  'en-US': enElementLocale,
  'zh-CN': zhElementLocale
}

const i18n = new VueI18n({
  locale: 'en-US',
  fallbackLocale: 'en-US',
  messages: { 'en-US': enUS }
})

const loadedLanguages = { 'en-US': true }

function setI18nLanguage (lang) {
  i18n.locale = lang
  document.querySelector('html').setAttribute('lang', lang)
  return lang
}

export function loadLanguageAsync (lang) {
  if (i18n.locale === lang && loadedLanguages[lang]) {
    return Promise.resolve(setI18nLanguage(lang))
  }

  if (loadedLanguages[lang]) {
    return Promise.resolve(setI18nLanguage(lang))
  }

  return import(/* webpackChunkName: "lang-[request]" */ `./locales/${lang}.json`).then(
    messages => {
      i18n.setLocaleMessage(lang, messages.default)
      loadedLanguages[lang] = true
      return setI18nLanguage(lang)
    }
  )
}

export function setAppLanguage (lang) {
  loadLanguageAsync(lang).then(() => {
    if (elementLocales[lang]) {
      locale.use(elementLocales[lang])
    }
    ipcRenderer.send('mt::set-locale', lang, i18n.messages[lang])
  })
}

export default i18n
