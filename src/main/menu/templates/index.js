import edit from './edit'
import prefEdit from './prefEdit'
import file from './file'
import help from './help'
import marktext from './marktext'
import view from './view'
import window from './window'
import paragraph from './paragraph'
import format from './format'
import theme from './theme'
import { translateMenuTemplate } from '../../i18n'

export dockMenu from './dock'

/**
 * Create the setting window menu.
 *
 * @param {Keybindings} keybindings The keybindings instance
 */
export const configSettingMenu = (keybindings, preferences = null, language = null) => {
  const menuTemplate = [
    ...(process.platform === 'darwin' ? [marktext(keybindings)] : []),
    prefEdit(keybindings),
    help()
  ]
  return translateMenuTemplate(menuTemplate, language || (preferences && preferences.getItem('language')))
}

/**
 * Create the application menu for the editor window.
 *
 * @param {Keybindings} keybindings The keybindings instance.
 * @param {Preference} preferences The preference instance.
 * @param {string[]} recentlyUsedFiles The recently used files.
 */
export default function (keybindings, preferences, recentlyUsedFiles, language = null) {
  const menuTemplate = [
    ...(process.platform === 'darwin' ? [marktext(keybindings)] : []),
    file(keybindings, preferences, recentlyUsedFiles),
    edit(keybindings),
    paragraph(keybindings),
    format(keybindings),
    window(keybindings),
    theme(preferences),
    view(keybindings),
    help()
  ]
  return translateMenuTemplate(menuTemplate, language || preferences.getItem('language'))
}
