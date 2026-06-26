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

// Each built-in theme's editor background colour, kept in sync with the
// `--editorBgColor` of the matching renderer theme (renderer/src/assets/themes/
// *.theme.css; the default light theme lives in styles/index.css and is handled
// by the white fallback below). The main process paints a freshly-created window
// with this colour before the renderer loads, so a dark theme no longer flashes
// white on launch (#3957).
const themeBackgroundColors: ReadonlyMap<string, string> = new Map([
  ['ayu-dark', '#0a0e14'],
  ['ayu-light', '#fafafa'],
  ['ayu-mirage', '#1f2430'],
  ['catppuccin-latte', '#eff1f5'],
  ['catppuccin-mocha', '#1e1e2e'],
  ['cyberdream', '#16181a'],
  ['dark', '#282828'],
  ['dracula', '#282a36'],
  ['everforest-dark', '#2d353b'],
  ['everforest-light', '#fdf6e3'],
  ['graphite', '#f7f7f7'],
  ['gruvbox-dark', '#282828'],
  ['gruvbox-light', '#fbf1c7'],
  ['horizon-dark', '#1c1e26'],
  ['kanagawa', '#1f1f28'],
  ['material-dark', '#34393f'],
  ['monokai-pro', '#2d2a2e'],
  ['nightfox', '#192330'],
  ['nord', '#2e3440'],
  ['one-dark', '#282c34'],
  ['oxocarbon-dark', '#161616'],
  ['palenight', '#292d3e'],
  ['rose-pine', '#191724'],
  ['rose-pine-dawn', '#faf4ed'],
  ['rose-pine-moon', '#232136'],
  ['solarized-dark', '#002b36'],
  ['solarized-light', '#fdf6e3'],
  ['synthwave-84', '#262335'],
  ['tokyo-night', '#1a1b26'],
  ['tokyo-night-light', '#d5d6db'],
  ['tokyo-night-storm', '#24283b'],
  ['ulysses', '#f3f3f3']
])

const DARK_FALLBACK_BACKGROUND = '#282828'
const LIGHT_FALLBACK_BACKGROUND = '#ffffff'

/**
 * Background colour to paint a freshly-created window before the renderer
 * loads, so the window matches the active theme instead of flashing white
 * (#3957). Falls back by dark/light classification for any theme without an
 * explicit colour (e.g. the default light theme or a future/custom theme).
 */
export const getThemeBackgroundColor = (theme: string | undefined): string => {
  const exact = typeof theme === 'string' ? themeBackgroundColors.get(theme) : undefined
  if (exact) return exact
  return isDarkThemeId(theme) ? DARK_FALLBACK_BACKGROUND : LIGHT_FALLBACK_BACKGROUND
}
