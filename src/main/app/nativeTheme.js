const DARK_THEME_IDS = new Set([
  'ayu-dark',
  'ayu-mirage',
  'catppuccin-mocha',
  'cyberdream',
  'dark',
  'dracula',
  'everforest-dark',
  'gruvbox-dark',
  'horizon-dark',
  'kanagawa',
  'material-dark',
  'monokai-pro',
  'nightfox',
  'nord',
  'one-dark',
  'oxocarbon-dark',
  'palenight',
  'rose-pine',
  'rose-pine-moon',
  'solarized-dark',
  'synthwave-84',
  'tokyo-night',
  'tokyo-night-storm'
])

export const isDarkApplicationTheme = (theme) => {
  return typeof theme === 'string' && DARK_THEME_IDS.has(theme)
}

export const getNativeThemeSource = ({ followSystemTheme, theme }) => {
  if (followSystemTheme) {
    return 'system'
  }
  return isDarkApplicationTheme(theme) ? 'dark' : 'light'
}
