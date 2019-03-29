import darkTheme from  '../assets/themes/dark.theme.css'
import graphiteTheme from '../assets/themes/graphite.theme.css'
import materialDarkTheme from '../assets/themes/material-dark.theme.css'
import oneDarkTheme from '../assets/themes/one-dark.theme.css'
import ulyssesTheme from '../assets/themes/ulysses.theme.css'

import darkPrismTheme from '../assets/themes/prismjs/dark.theme.css'
import oneDarkPrismTheme from '../assets/themes/prismjs/one-dark.theme.css'

export const dark = () => {
  return darkTheme + '\n' + darkPrismTheme
}

export const graphite = () => {
  return graphiteTheme
}

export const materialDark = () => {
  return materialDarkTheme + '\n' + darkPrismTheme
}

export const oneDark = () => {
  return oneDarkTheme + '\n' + oneDarkPrismTheme
}

export const ulysses = () => {
  return ulyssesTheme
}
