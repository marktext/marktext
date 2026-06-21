import { type MenuItemConstructorOptions } from 'electron'
import * as actions from '../actions/theme'
import { t } from '../../i18n'
import type Preference from '../../preferences'

// [i18nLabelKey, themeId] for each selectable theme. The menu label is
// `menu.theme.<labelKey>`; `themeId` is both the menu item id and the value
// passed to `selectTheme` / compared against the saved theme. (A few light
// themes keep historical ids, e.g. cadmiumLight -> 'light'.)
const LIGHT_THEMES: ReadonlyArray<readonly [string, string]> = [
  ['ayuLight', 'ayu-light'],
  ['cadmiumLight', 'light'],
  ['catppuccinLatte', 'catppuccin-latte'],
  ['everforestLight', 'everforest-light'],
  ['graphiteLight', 'graphite'],
  ['gruvboxLight', 'gruvbox-light'],
  ['rosePineDawn', 'rose-pine-dawn'],
  ['solarizedLight', 'solarized-light'],
  ['tokyoNightLight', 'tokyo-night-light'],
  ['ulyssesLight', 'ulysses']
]

const DARK_THEMES: ReadonlyArray<readonly [string, string]> = [
  ['ayuDark', 'ayu-dark'],
  ['ayuMirage', 'ayu-mirage'],
  ['cadmiumDark', 'dark'],
  ['catppuccinMocha', 'catppuccin-mocha'],
  ['cyberdream', 'cyberdream'],
  ['dracula', 'dracula'],
  ['everforestDark', 'everforest-dark'],
  ['gruvboxDark', 'gruvbox-dark'],
  ['horizonDark', 'horizon-dark'],
  ['kanagawa', 'kanagawa'],
  ['materialDark', 'material-dark'],
  ['monokaiPro', 'monokai-pro'],
  ['nightfox', 'nightfox'],
  ['nord', 'nord'],
  ['oneDark', 'one-dark'],
  ['oxocarbonDark', 'oxocarbon-dark'],
  ['palenight', 'palenight'],
  ['rosePine', 'rose-pine'],
  ['rosePineMoon', 'rose-pine-moon'],
  ['solarizedDark', 'solarized-dark'],
  ['synthwave84', 'synthwave-84'],
  ['tokyoNight', 'tokyo-night'],
  ['tokyoNightStorm', 'tokyo-night-storm']
]

export default function(userPreference: Preference): MenuItemConstructorOptions {
  const preferences = userPreference.getAll() as { theme?: string; followSystemTheme?: boolean }
  const { theme, followSystemTheme } = preferences
  const isThemeSelectionEnabled = !followSystemTheme

  const themeRadio = ([labelKey, id]: readonly [string, string]): MenuItemConstructorOptions => ({
    label: t(`menu.theme.${labelKey}`),
    type: 'radio',
    id,
    enabled: isThemeSelectionEnabled,
    checked: theme === id,
    click() {
      actions.selectTheme(id)
    }
  })

  const submenu: MenuItemConstructorOptions[] = [
    // Follow System Theme
    {
      label: t('preferences.theme.followSystemTheme'),
      type: 'checkbox',
      id: 'follow-system-theme',
      checked: !!followSystemTheme,
      click(menuItem) {
        actions.setFollowSystemTheme(menuItem.checked)
      }
    }
  ]

  if (!isThemeSelectionEnabled) {
    submenu.push({
      label: t('menu.theme.followThemDisabled'),
      enabled: false
    })
  }

  // Group themes into nested submenus so the top-level Theme menu stays short
  // instead of expanding to the full window height with 30+ flat items (#4534).
  submenu.push(
    { type: 'separator' },
    {
      label: t('menu.theme.lightThemes'),
      submenu: LIGHT_THEMES.map(themeRadio)
    },
    {
      label: t('menu.theme.darkThemes'),
      submenu: DARK_THEMES.map(themeRadio)
    }
  )

  return {
    label: t('menu.theme.theme'),
    id: 'themeMenu',
    submenu
  }
}
