import { isDarkThemeId } from '../../common/theme'

export type NativeThemeSource = 'system' | 'dark' | 'light'

export const isDarkApplicationTheme = (theme: unknown): boolean => {
  return isDarkThemeId(theme)
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
