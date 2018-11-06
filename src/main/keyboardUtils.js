import { getCurrentKeyboardLayout, getCurrentKeyboardLanguage, getCurrentKeymap } from 'keyboard-layout'

export const getKeyboardLanguage = () => {
  const lang = getCurrentKeyboardLanguage()
  if (lang.length >= 2) {
    return lang.substring(0, 2)
  }
  return lang
}

export const dumpKeyboardInformation = () => {
  return `Layout: ${getCurrentKeyboardLayout()}\n` +
    `Language: ${getCurrentKeyboardLanguage()}\n\n` +
    JSON.stringify(getCurrentKeymap(), null, 2)
}
