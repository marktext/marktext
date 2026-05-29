import darkTheme from '../themes/dark.theme.css?inline'
import graphiteTheme from '../themes/graphite.theme.css?inline'
import materialDarkTheme from '../themes/material-dark.theme.css?inline'
import oneDarkTheme from '../themes/one-dark.theme.css?inline'
import ulyssesTheme from '../themes/ulysses.theme.css?inline'

import darkPrismTheme from '../themes/prismjs/dark.theme.css?inline'
import oneDarkPrismTheme from '../themes/prismjs/one-dark.theme.css?inline'

export const dark = (): string => {
  return darkTheme + '\n' + darkPrismTheme
}

export const graphite = (): string => {
  return graphiteTheme
}

export const materialDark = (): string => {
  return materialDarkTheme + '\n' + darkPrismTheme
}

export const oneDark = (): string => {
  return oneDarkTheme + '\n' + oneDarkPrismTheme
}

export const ulysses = (): string => {
  return ulyssesTheme
}
