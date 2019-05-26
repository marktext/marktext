import { THEME_STYLE_ID, COMMON_STYLE_ID, DEFAULT_CODE_FONT_FAMILY, oneDarkThemes, railscastsThemes } from '../config'
import { dark, graphite, materialDark, oneDark, ulysses } from './themeColor'
import { isLinux } from './index'
import elementStyle from 'element-ui/lib/theme-chalk/index.css'

const ORIGINAL_THEME = '#409EFF'
const patchTheme = css => {
  return `@media not print {\n${css}\n}`
}

const getEmojiPickerPatch = () => {
  return isLinux ? `.ag-emoji-picker section .emoji-wrapper .item span {
  font-family: sans-serif, "Noto Color Emoji";
}` : ''
}

const getThemeCluster = themeColor => {
  const tintColor = (color, tint) => {
    let red = parseInt(color.slice(1, 3), 16)
    let green = parseInt(color.slice(3, 5), 16)
    let blue = parseInt(color.slice(5, 7), 16)
    if (tint === 0) { // when primary color is in its rgb space
      return [red, green, blue].join(',')
    } else {
      red += Math.round(tint * (255 - red))
      green += Math.round(tint * (255 - green))
      blue += Math.round(tint * (255 - blue))
      red = red.toString(16)
      green = green.toString(16)
      blue = blue.toString(16)
      return `#${ red }${ green }${ blue }`
    }
  }

  const clusters = [{
    color: themeColor,
    variable: 'var(--themeColor)'
  }]
  for (let i = 9; i >= 1; i--) {
    clusters.push({
      color: tintColor(themeColor, Number((i / 10).toFixed(2))),
      variable: `var(--themeColor${10 - i}0)`
    })
  }

  return clusters
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
font-size: ${codeFontSize}px;
}

${getEmojiPickerPatch()}
`
}

export const addElementStyle = () => {
  const ID = 'mt-el-style'
  let sheet = document.querySelector(`#${ID}`)
  if (sheet) {
    return
  }
  const themeCluster = getThemeCluster(ORIGINAL_THEME)
  let newElementStyle = elementStyle
  for (const { color, variable } of themeCluster) {
    newElementStyle = newElementStyle.replace(new RegExp(color, 'ig'), variable)
  }
  sheet = document.createElement('style')
  sheet.id = ID
  document.head.appendChild(sheet)
  sheet.innerHTML = newElementStyle
}

// Append common sheet and theme at the end of head - order is important.
export const addStyles = style => {
  const { theme } = style
  addThemeStyle(theme)
  addCommonStyle(style)
}
