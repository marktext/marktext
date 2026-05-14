import { isDarkThemeId } from '../../common/theme'

export const isDarkApplicationTheme = (theme) => {
  return isDarkThemeId(theme)
}

export const getNativeThemeSource = ({ followSystemTheme, theme }) => {
  if (followSystemTheme) {
    return 'system'
  }
  return isDarkApplicationTheme(theme) ? 'dark' : 'light'
}
