import path from 'path'
import { isLinux } from './util'
export const PATH_SEPARATOR = path.sep

export const THEME_STYLE_ID = 'ag-theme'
export const COMMON_STYLE_ID = 'ag-common-style'

export const DEFAULT_EDITOR_FONT_FAMILY = `"Open Sans", "Clear Sans", "Helvetica Neue", Helvetica, Arial, sans-serif ${isLinux ? ', "Noto Color Emoji"' : ''}`
export const DEFAULT_CODE_FONT_FAMILY = '"DejaVu Sans Mono", "Source Code Pro", "Droid Sans Mono", monospace'
export const DEFAULT_STYLE = {
  codeFontFamily: DEFAULT_CODE_FONT_FAMILY,
  codeFontSize: '14px',
  hideScrollbar: false,
  theme: 'light'
}

export const railscastsThemes = ['dark', 'material-dark']
export const oneDarkThemes = ['one-dark']
