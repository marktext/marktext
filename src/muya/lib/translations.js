import enUS from '@/i18n/locales/en-US.json'

let currentLang = 'en-US'
let messages = { 'en-US': enUS }

export function loadLang (lang, data) {
  currentLang = lang
  messages[lang] = data
}

export function t (key) {
  const msg = messages[currentLang]
  if (msg && msg[key]) return msg[key]
  // Fallback to en-US
  if (messages['en-US'] && messages['en-US'][key]) return messages['en-US'][key]
  return key
}

export { currentLang, messages }
