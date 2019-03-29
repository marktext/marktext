import { THEME_STYLE_ID, COMMON_STYLE_ID, DEFAULT_CODE_FONT_FAMILY, oneDarkThemes, railscastsThemes } from '../config'
import { dark, graphite, materialDark, oneDark, ulysses } from './themeColor'

const patchTheme = css => {
  return `@media not print {\n${css}\n}`
}

export const addThemeStyle = theme => {
  const isCmRailscasts = railscastsThemes.includes(theme)
  const isCmOneDark = oneDarkThemes.includes(theme)
  const isDarkTheme = isCmOneDark || isCmRailscasts
  let themeStyleEle = document.querySelector(`#${THEME_STYLE_ID}`)
  if (!themeStyleEle) {
    themeStyleEle = document.createElement('style')
    themeStyleEle.id = THEME_STYLE_ID
    document.head.appendChild(themeStyleEle)
  }

  switch (theme) {
    case 'light':
      themeStyleEle.innerHTML = ''
      break
    case 'dark':
      themeStyleEle.innerHTML = patchTheme(dark())
      break
    case 'material-dark':
      themeStyleEle.innerHTML = patchTheme(materialDark())
      break
    case 'ulysses':
      themeStyleEle.innerHTML = patchTheme(ulysses())
      break
    case 'graphite':
      themeStyleEle.innerHTML = patchTheme(graphite())
      break
    case 'one-dark':
      themeStyleEle.innerHTML = patchTheme(oneDark())
      break
    default:
      console.log('unknown theme')
      break
  }

  // workaround: use dark icons
  document.body.classList.remove('dark')
  if (isDarkTheme) {
    document.body.classList.add('dark')
  }

  // change CodeMirror theme
  const cm = document.querySelector('.CodeMirror')
  if (cm) {
    cm.classList.remove('cm-s-default')
    cm.classList.remove('cm-s-one-dark')
    cm.classList.remove('cm-s-railscasts')
    if (isCmOneDark) {
      cm.classList.add('cm-s-one-dark')
    } else if (isCmRailscasts) {
      cm.classList.add('cm-s-railscasts')
    } else {
      cm.classList.add('cm-s-default')
    }
  }
}

export const addCommonStyle = style => {
  const { codeFontFamily, codeFontSize } = style
  let sheet = document.querySelector(`#${COMMON_STYLE_ID}`)
  if (!sheet) {
    sheet = document.createElement('style')
    sheet.id = COMMON_STYLE_ID
    document.head.appendChild(sheet)
  }
  sheet.innerHTML = `
span code,
td code,
th code,
code,
code[class*="language-"],
.CodeMirror,
pre.ag-paragraph {
font-family: ${codeFontFamily}, ${DEFAULT_CODE_FONT_FAMILY};
font-size: ${codeFontSize};
}
`
}

// Append common sheet and theme at the end of head - order is important.
export const addStyles = style => {
  const { theme } = style
  addThemeStyle(theme)
  addCommonStyle(style)
}
