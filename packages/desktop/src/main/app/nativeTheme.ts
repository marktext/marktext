import { isDarkThemeId } from '../../common/theme'
import { isDarkCustomTheme } from '../themes'

export type NativeThemeSource = 'system' | 'dark' | 'light'

export const isDarkApplicationTheme = (theme: unknown): boolean => {
  if (isDarkThemeId(theme)) return true
  // Custom themes (`custom:<id>`) declare light/dark via their @type header, so
  // the dark check for them is resolved from the themes folder.
  if (typeof theme === 'string' && theme.startsWith('custom:')) {
    return isDarkCustomTheme(theme)
  }
  return false
}

export const getNativeThemeSource = ({
  followSystemTheme,
  theme
}: {
  followSystemTheme: boolean
  theme: unknown
}): NativeThemeSource => {
  if (followSystemTheme) {
    return 'system'
  }
  return isDarkApplicationTheme(theme) ? 'dark' : 'light'
}
