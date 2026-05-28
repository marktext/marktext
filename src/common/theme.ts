export const railscastsThemes: readonly string[] = Object.freeze([
  'dark',
  'material-dark',
  // New gogh dark themes
  'dracula',
  'nord',
  'catppuccin-mocha',
  'gruvbox-dark',
  'tokyo-night',
  'tokyo-night-storm',
  'solarized-dark',
  'ayu-dark',
  'ayu-mirage',
  'everforest-dark',
  'rose-pine',
  'rose-pine-moon',
  'monokai-pro',
  'synthwave-84',
  'horizon-dark',
  'palenight',
  'oxocarbon-dark',
  'kanagawa',
  'nightfox',
  'cyberdream'
])

export const oneDarkThemes: readonly string[] = Object.freeze(['one-dark'])

export const isDarkThemeId = (theme: unknown): theme is string => {
  return (
    typeof theme === 'string' && (railscastsThemes.includes(theme) || oneDarkThemes.includes(theme))
  )
}
