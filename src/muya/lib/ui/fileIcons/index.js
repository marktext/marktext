// Because the sidebar also use the file icons, So I put this file out of floatBox directory.
import '@marktext/file-icons/build/index.css'
import fileIcons from '@marktext/file-icons'

fileIcons.getClassByName = function (name) {
  const icon = fileIcons.matchName(name)

  return icon ? icon.getClass(0, false) : null
}

fileIcons.getClassByLanguage = function (lang) {
  const icon = fileIcons.matchLanguage(lang)

  return icon ? icon.getClass(0, false) : null
}

export default fileIcons
