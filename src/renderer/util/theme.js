import { THEME_LINK_ID, COMMON_STYLE_ID, DEFAULT_CODE_FONT_FAMILY } from '../config'

export const addThemeStyle = theme => {
  const href = process.env.NODE_ENV !== 'production'
    ? `./src/muya/themes/${theme}.css`
    : `./static/themes/${theme}.css`

    let link = document.querySelector(`#${THEME_LINK_ID}`)
    if (!link) {
      link = document.createElement('link')
      link.setAttribute('rel', 'stylesheet')
      link.id = THEME_LINK_ID
      document.head.appendChild(link)
    }
    link.href = href
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
