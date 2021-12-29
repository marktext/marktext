// Because the sidebar also use the file icons, So I put this file out of floatBox directory.
import '@marktext/file-icons/build/index.css'
import fileIcons from '@marktext/file-icons'

fileIcons.getClassByName = function (name) {
  const icon = fileIcons.matchName(name)
  const classNames = icon ? icon.getClass(0, false) : null
  // TODO JOCS https://github.com/file-icons/atom/issues/865
  return classNames.replace(/icon-file-text/, 'text-icon')
}
fileIcons.getClassByLanguage = function (lang) {
  const icon = fileIcons.matchLanguage(lang)

  return icon ? icon.getClass(0, false) : null
}

export default fileIcons
