import { type MenuItemConstructorOptions } from 'electron'
import * as actions from '../actions/theme'
import { t } from '../../i18n'
import type Preference from '../../preferences'

export default function(userPreference: Preference): MenuItemConstructorOptions {
  const preferences = userPreference.getAll() as { theme?: string; followSystemTheme?: boolean }
  const { theme, followSystemTheme } = preferences
  const isThemeSelectionEnabled = !followSystemTheme

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

  submenu.push(
    // Light Themes (alphabetical)
    {
      label: t('menu.theme.lightThemes'),
      enabled: false
    },
    {
      label: t('menu.theme.ayuLight'),
      type: 'radio',
      id: 'ayu-light',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'ayu-light',
      click() {
        actions.selectTheme('ayu-light')
      }
    },
    {
      label: t('menu.theme.cadmiumLight'),
      type: 'radio',
      id: 'light',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'light',
      click() {
        actions.selectTheme('light')
      }
    },
    {
      label: t('menu.theme.catppuccinLatte'),
      type: 'radio',
      id: 'catppuccin-latte',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'catppuccin-latte',
      click() {
        actions.selectTheme('catppuccin-latte')
      }
    },
    {
      label: t('menu.theme.everforestLight'),
      type: 'radio',
      id: 'everforest-light',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'everforest-light',
      click() {
        actions.selectTheme('everforest-light')
      }
    },
    {
      label: t('menu.theme.graphiteLight'),
      type: 'radio',
      id: 'graphite',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'graphite',
      click() {
        actions.selectTheme('graphite')
      }
    },
    {
      label: t('menu.theme.gruvboxLight'),
      type: 'radio',
      id: 'gruvbox-light',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'gruvbox-light',
      click() {
        actions.selectTheme('gruvbox-light')
      }
    },
    {
      label: t('menu.theme.rosePineDawn'),
      type: 'radio',
      id: 'rose-pine-dawn',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'rose-pine-dawn',
      click() {
        actions.selectTheme('rose-pine-dawn')
      }
    },
    {
      label: t('menu.theme.solarizedLight'),
      type: 'radio',
      id: 'solarized-light',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'solarized-light',
      click() {
        actions.selectTheme('solarized-light')
      }
    },
    {
      label: t('menu.theme.tokyoNightLight'),
      type: 'radio',
      id: 'tokyo-night-light',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'tokyo-night-light',
      click() {
        actions.selectTheme('tokyo-night-light')
      }
    },
    {
      label: t('menu.theme.ulyssesLight'),
      type: 'radio',
      id: 'ulysses',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'ulysses',
      click() {
        actions.selectTheme('ulysses')
      }
    },
    { type: 'separator' },
    // Dark Themes (alphabetical)
    {
      label: t('menu.theme.darkThemes'),
      enabled: false
    },
    {
      label: t('menu.theme.ayuDark'),
      type: 'radio',
      id: 'ayu-dark',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'ayu-dark',
      click() {
        actions.selectTheme('ayu-dark')
      }
    },
    {
      label: t('menu.theme.ayuMirage'),
      type: 'radio',
      id: 'ayu-mirage',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'ayu-mirage',
      click() {
        actions.selectTheme('ayu-mirage')
      }
    },
    {
      label: t('menu.theme.cadmiumDark'),
      type: 'radio',
      id: 'dark',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'dark',
      click() {
        actions.selectTheme('dark')
      }
    },
    {
      label: t('menu.theme.catppuccinMocha'),
      type: 'radio',
      id: 'catppuccin-mocha',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'catppuccin-mocha',
      click() {
        actions.selectTheme('catppuccin-mocha')
      }
    },
    {
      label: t('menu.theme.cyberdream'),
      type: 'radio',
      id: 'cyberdream',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'cyberdream',
      click() {
        actions.selectTheme('cyberdream')
      }
    },
    {
      label: t('menu.theme.dracula'),
      type: 'radio',
      id: 'dracula',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'dracula',
      click() {
        actions.selectTheme('dracula')
      }
    },
    {
      label: t('menu.theme.everforestDark'),
      type: 'radio',
      id: 'everforest-dark',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'everforest-dark',
      click() {
        actions.selectTheme('everforest-dark')
      }
    },
    {
      label: t('menu.theme.gruvboxDark'),
      type: 'radio',
      id: 'gruvbox-dark',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'gruvbox-dark',
      click() {
        actions.selectTheme('gruvbox-dark')
      }
    },
    {
      label: t('menu.theme.horizonDark'),
      type: 'radio',
      id: 'horizon-dark',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'horizon-dark',
      click() {
        actions.selectTheme('horizon-dark')
      }
    },
    {
      label: t('menu.theme.kanagawa'),
      type: 'radio',
      id: 'kanagawa',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'kanagawa',
      click() {
        actions.selectTheme('kanagawa')
      }
    },
    {
      label: t('menu.theme.materialDark'),
      type: 'radio',
      id: 'material-dark',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'material-dark',
      click() {
        actions.selectTheme('material-dark')
      }
    },
    {
      label: t('menu.theme.monokaiPro'),
      type: 'radio',
      id: 'monokai-pro',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'monokai-pro',
      click() {
        actions.selectTheme('monokai-pro')
      }
    },
    {
      label: t('menu.theme.nightfox'),
      type: 'radio',
      id: 'nightfox',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'nightfox',
      click() {
        actions.selectTheme('nightfox')
      }
    },
    {
      label: t('menu.theme.nord'),
      type: 'radio',
      id: 'nord',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'nord',
      click() {
        actions.selectTheme('nord')
      }
    },
    {
      label: t('menu.theme.oneDark'),
      type: 'radio',
      id: 'one-dark',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'one-dark',
      click() {
        actions.selectTheme('one-dark')
      }
    },
    {
      label: t('menu.theme.oxocarbonDark'),
      type: 'radio',
      id: 'oxocarbon-dark',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'oxocarbon-dark',
      click() {
        actions.selectTheme('oxocarbon-dark')
      }
    },
    {
      label: t('menu.theme.palenight'),
      type: 'radio',
      id: 'palenight',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'palenight',
      click() {
        actions.selectTheme('palenight')
      }
    },
    {
      label: t('menu.theme.rosePine'),
      type: 'radio',
      id: 'rose-pine',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'rose-pine',
      click() {
        actions.selectTheme('rose-pine')
      }
    },
    {
      label: t('menu.theme.rosePineMoon'),
      type: 'radio',
      id: 'rose-pine-moon',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'rose-pine-moon',
      click() {
        actions.selectTheme('rose-pine-moon')
      }
    },
    {
      label: t('menu.theme.solarizedDark'),
      type: 'radio',
      id: 'solarized-dark',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'solarized-dark',
      click() {
        actions.selectTheme('solarized-dark')
      }
    },
    {
      label: t('menu.theme.synthwave84'),
      type: 'radio',
      id: 'synthwave-84',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'synthwave-84',
      click() {
        actions.selectTheme('synthwave-84')
      }
    },
    {
      label: t('menu.theme.tokyoNight'),
      type: 'radio',
      id: 'tokyo-night',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'tokyo-night',
      click() {
        actions.selectTheme('tokyo-night')
      }
    },
    {
      label: t('menu.theme.tokyoNightStorm'),
      type: 'radio',
      id: 'tokyo-night-storm',
      enabled: isThemeSelectionEnabled,
      checked: theme === 'tokyo-night-storm',
      click() {
        actions.selectTheme('tokyo-night-storm')
      }
    }
  )
  return {
    label: t('menu.theme.theme'),
    id: 'themeMenu',
    submenu
  }
}
