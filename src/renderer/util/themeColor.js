import darkTheme from '../assets/themes/dark.theme.css'
import graphiteTheme from '../assets/themes/graphite.theme.css'
import materialDarkTheme from '../assets/themes/material-dark.theme.css'
import oneDarkTheme from '../assets/themes/one-dark.theme.css'
import ulyssesTheme from '../assets/themes/ulysses.theme.css'
import neonEditorialTheme from '../assets/themes/neon-editorial.theme.css'
import neonEditorialDarkTheme from '../assets/themes/neon-editorial-dark.theme.css'
import ashleyTheme from '../assets/themes/ashley.theme.css'
import ashleyDarkTheme from '../assets/themes/ashley-dark.theme.css'

import darkPrismTheme from '../assets/themes/prismjs/dark.theme.css'
import oneDarkPrismTheme from '../assets/themes/prismjs/one-dark.theme.css'
import neonEditorialDarkPrismTheme from '../assets/themes/prismjs/neon-editorial-dark.theme.css'
import ashleyDarkPrismTheme from '../assets/themes/prismjs/ashley-dark.theme.css'

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

export const neonEditorial = () => {
  return neonEditorialTheme
}

export const neonEditorialDark = () => {
  return neonEditorialDarkTheme + '\n' + neonEditorialDarkPrismTheme
}

export const ashley = () => {
  return ashleyTheme
}

export const ashleyDark = () => {
  return ashleyDarkTheme + '\n' + ashleyDarkPrismTheme
}
