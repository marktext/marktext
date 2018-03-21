import * as actions from '../actions/theme'
import userPreference from '../preference'

const { theme } = userPreference.getAll()

export default {
  label: 'Theme',
  submenu: [{
    label: 'Dark',
    type: 'radio',
    checked: theme === 'dark',
    click (menuItem, browserWindow) {
      actions.selectTheme('dark')
    }
  }, {
    label: 'Light',
    type: 'radio',
    checked: theme === 'light',
    click (menuItem, browserWindow) {
      actions.selectTheme('light')
    }
  }]
}
