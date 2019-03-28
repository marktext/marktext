import darkTheme from '../../muya/themes/dark.theme.css'
import graphiteTheme from '../../muya/themes/graphite.theme.css'
import materialDarkTheme from '../../muya/themes/material-dark.theme.css'
import oneDarkTheme from '../../muya/themes/one-dark.theme.css'
import ulyssesTheme from '../../muya/themes/ulysses.theme.css'

import darkPrismTheme from '../../muya/themes/prismjs/dark.theme.css'
import oneDarkPrismTheme from '../../muya/themes/prismjs/one-dark.theme.css'

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

// ------------
