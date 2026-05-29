import {
  dark as darkTheme,
  graphite as graphiteTheme,
  materialDark as materialDarkTheme,
  oneDark as oneDarkTheme,
  ulysses as ulyssesTheme,
  darkPrism as darkPrismTheme,
  oneDarkPrism as oneDarkPrismTheme
} from '@/generated/theme-css'

export const dark = (): string => darkTheme + '\n' + darkPrismTheme
export const graphite = (): string => graphiteTheme
export const materialDark = (): string => materialDarkTheme + '\n' + darkPrismTheme
export const oneDark = (): string => oneDarkTheme + '\n' + oneDarkPrismTheme
export const ulysses = (): string => ulyssesTheme
