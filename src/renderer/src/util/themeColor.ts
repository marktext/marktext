import darkTheme from '../assets/themes/dark.theme.css?inline'
import graphiteTheme from '../assets/themes/graphite.theme.css?inline'
import materialDarkTheme from '../assets/themes/material-dark.theme.css?inline'
import oneDarkTheme from '../assets/themes/one-dark.theme.css?inline'
import ulyssesTheme from '../assets/themes/ulysses.theme.css?inline'

// New gogh themes - Dark
import draculaTheme from '../assets/themes/dracula.theme.css?inline'
import nordTheme from '../assets/themes/nord.theme.css?inline'
import catppuccinMochaTheme from '../assets/themes/catppuccin-mocha.theme.css?inline'
import gruvboxDarkTheme from '../assets/themes/gruvbox-dark.theme.css?inline'
import tokyoNightTheme from '../assets/themes/tokyo-night.theme.css?inline'
import tokyoNightStormTheme from '../assets/themes/tokyo-night-storm.theme.css?inline'
import solarizedDarkTheme from '../assets/themes/solarized-dark.theme.css?inline'
import ayuDarkTheme from '../assets/themes/ayu-dark.theme.css?inline'
import ayuMirageTheme from '../assets/themes/ayu-mirage.theme.css?inline'
import everforestDarkTheme from '../assets/themes/everforest-dark.theme.css?inline'
import rosePineTheme from '../assets/themes/rose-pine.theme.css?inline'
import rosePineMoonTheme from '../assets/themes/rose-pine-moon.theme.css?inline'
import monokaiProTheme from '../assets/themes/monokai-pro.theme.css?inline'
import synthwave84Theme from '../assets/themes/synthwave-84.theme.css?inline'
import horizonDarkTheme from '../assets/themes/horizon-dark.theme.css?inline'
import palenightTheme from '../assets/themes/palenight.theme.css?inline'
import oxocarbonDarkTheme from '../assets/themes/oxocarbon-dark.theme.css?inline'
import kanagawaTheme from '../assets/themes/kanagawa.theme.css?inline'
import nightfoxTheme from '../assets/themes/nightfox.theme.css?inline'
import cyberdreamTheme from '../assets/themes/cyberdream.theme.css?inline'

// New gogh themes - Light
import catppuccinLatteTheme from '../assets/themes/catppuccin-latte.theme.css?inline'
import gruvboxLightTheme from '../assets/themes/gruvbox-light.theme.css?inline'
import tokyoNightLightTheme from '../assets/themes/tokyo-night-light.theme.css?inline'
import solarizedLightTheme from '../assets/themes/solarized-light.theme.css?inline'
import ayuLightTheme from '../assets/themes/ayu-light.theme.css?inline'
import everforestLightTheme from '../assets/themes/everforest-light.theme.css?inline'
import rosePineDawnTheme from '../assets/themes/rose-pine-dawn.theme.css?inline'

// Prism.js syntax highlighting themes
import darkPrismTheme from '../assets/themes/prismjs/dark.theme.css?inline'
import oneDarkPrismTheme from '../assets/themes/prismjs/one-dark.theme.css?inline'
import draculaPrismTheme from '../assets/themes/prismjs/dracula.theme.css?inline'
import nordPrismTheme from '../assets/themes/prismjs/nord.theme.css?inline'
import catppuccinMochaPrismTheme from '../assets/themes/prismjs/catppuccin-mocha.theme.css?inline'
import catppuccinLattePrismTheme from '../assets/themes/prismjs/catppuccin-latte.theme.css?inline'
import gruvboxDarkPrismTheme from '../assets/themes/prismjs/gruvbox-dark.theme.css?inline'
import gruvboxLightPrismTheme from '../assets/themes/prismjs/gruvbox-light.theme.css?inline'
import tokyoNightPrismTheme from '../assets/themes/prismjs/tokyo-night.theme.css?inline'
import tokyoNightStormPrismTheme from '../assets/themes/prismjs/tokyo-night-storm.theme.css?inline'
import tokyoNightLightPrismTheme from '../assets/themes/prismjs/tokyo-night-light.theme.css?inline'
import rosePinePrismTheme from '../assets/themes/prismjs/rose-pine.theme.css?inline'
import rosePineMoonPrismTheme from '../assets/themes/prismjs/rose-pine-moon.theme.css?inline'
import rosePineDawnPrismTheme from '../assets/themes/prismjs/rose-pine-dawn.theme.css?inline'
import monokaiProPrismTheme from '../assets/themes/prismjs/monokai-pro.theme.css?inline'
import synthwave84PrismTheme from '../assets/themes/prismjs/synthwave-84.theme.css?inline'
import solarizedDarkPrismTheme from '../assets/themes/prismjs/solarized-dark.theme.css?inline'
import solarizedLightPrismTheme from '../assets/themes/prismjs/solarized-light.theme.css?inline'
import palenightPrismTheme from '../assets/themes/prismjs/palenight.theme.css?inline'
import kanagawaPrismTheme from '../assets/themes/prismjs/kanagawa.theme.css?inline'
import everforestDarkPrismTheme from '../assets/themes/prismjs/everforest-dark.theme.css?inline'
import everforestLightPrismTheme from '../assets/themes/prismjs/everforest-light.theme.css?inline'
import ayuDarkPrismTheme from '../assets/themes/prismjs/ayu-dark.theme.css?inline'
import ayuMiragePrismTheme from '../assets/themes/prismjs/ayu-mirage.theme.css?inline'
import ayuLightPrismTheme from '../assets/themes/prismjs/ayu-light.theme.css?inline'
import horizonDarkPrismTheme from '../assets/themes/prismjs/horizon-dark.theme.css?inline'
import oxocarbonDarkPrismTheme from '../assets/themes/prismjs/oxocarbon-dark.theme.css?inline'
import nightfoxPrismTheme from '../assets/themes/prismjs/nightfox.theme.css?inline'
import cyberdreamPrismTheme from '../assets/themes/prismjs/cyberdream.theme.css?inline'
import graphitePrismTheme from '../assets/themes/prismjs/graphite.theme.css?inline'
import ulyssesPrismTheme from '../assets/themes/prismjs/ulysses.theme.css?inline'

// Original themes
export const dark = (): string => {
  return darkTheme + '\n' + darkPrismTheme
}

export const graphite = (): string => {
  return graphiteTheme + '\n' + graphitePrismTheme
}

export const materialDark = (): string => {
  return materialDarkTheme + '\n' + darkPrismTheme
}

export const oneDark = (): string => {
  return oneDarkTheme + '\n' + oneDarkPrismTheme
}

export const ulysses = (): string => {
  return ulyssesTheme + '\n' + ulyssesPrismTheme
}

// New gogh themes - Dark (with matching Prism themes)
export const dracula = (): string => {
  return draculaTheme + '\n' + draculaPrismTheme
}

export const nord = (): string => {
  return nordTheme + '\n' + nordPrismTheme
}

export const catppuccinMocha = (): string => {
  return catppuccinMochaTheme + '\n' + catppuccinMochaPrismTheme
}

export const gruvboxDark = (): string => {
  return gruvboxDarkTheme + '\n' + gruvboxDarkPrismTheme
}

export const tokyoNight = (): string => {
  return tokyoNightTheme + '\n' + tokyoNightPrismTheme
}

export const tokyoNightStorm = (): string => {
  return tokyoNightStormTheme + '\n' + tokyoNightStormPrismTheme
}

export const solarizedDark = (): string => {
  return solarizedDarkTheme + '\n' + solarizedDarkPrismTheme
}

export const ayuDark = (): string => {
  return ayuDarkTheme + '\n' + ayuDarkPrismTheme
}

export const ayuMirage = (): string => {
  return ayuMirageTheme + '\n' + ayuMiragePrismTheme
}

export const everforestDark = (): string => {
  return everforestDarkTheme + '\n' + everforestDarkPrismTheme
}

export const rosePine = (): string => {
  return rosePineTheme + '\n' + rosePinePrismTheme
}

export const rosePineMoon = (): string => {
  return rosePineMoonTheme + '\n' + rosePineMoonPrismTheme
}

export const monokaiPro = (): string => {
  return monokaiProTheme + '\n' + monokaiProPrismTheme
}

export const synthwave84 = (): string => {
  return synthwave84Theme + '\n' + synthwave84PrismTheme
}

export const horizonDark = (): string => {
  return horizonDarkTheme + '\n' + horizonDarkPrismTheme
}

export const palenight = (): string => {
  return palenightTheme + '\n' + palenightPrismTheme
}

export const oxocarbonDark = (): string => {
  return oxocarbonDarkTheme + '\n' + oxocarbonDarkPrismTheme
}

export const kanagawa = (): string => {
  return kanagawaTheme + '\n' + kanagawaPrismTheme
}

export const nightfox = (): string => {
  return nightfoxTheme + '\n' + nightfoxPrismTheme
}

export const cyberdream = (): string => {
  return cyberdreamTheme + '\n' + cyberdreamPrismTheme
}

// New gogh themes - Light (with matching Prism themes)
export const catppuccinLatte = (): string => {
  return catppuccinLatteTheme + '\n' + catppuccinLattePrismTheme
}

export const gruvboxLight = (): string => {
  return gruvboxLightTheme + '\n' + gruvboxLightPrismTheme
}

export const tokyoNightLight = (): string => {
  return tokyoNightLightTheme + '\n' + tokyoNightLightPrismTheme
}

export const solarizedLight = (): string => {
  return solarizedLightTheme + '\n' + solarizedLightPrismTheme
}

export const ayuLight = (): string => {
  return ayuLightTheme + '\n' + ayuLightPrismTheme
}

export const everforestLight = (): string => {
  return everforestLightTheme + '\n' + everforestLightPrismTheme
}

export const rosePineDawn = (): string => {
  return rosePineDawnTheme + '\n' + rosePineDawnPrismTheme
}
