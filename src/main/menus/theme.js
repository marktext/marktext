import * as actions from '../actions/theme'
import userPreference from '../preference'

const { theme } = userPreference.getAll()

export default {
  label: 'Theme',
  submenu: [{
    label: 'Mateial Dark',
    type: 'radio',
    checked: theme === 'dark',
    click (menuItem, browserWindow) {
      actions.selectTheme('dark')
    }
  }, {
    label: 'Cadmium Light',
    type: 'radio',
    checked: theme === 'light',
    click (menuItem, browserWindow) {
      actions.selectTheme('light')
    }
  }, {
    label: 'Ulysses Light',
    type: 'radio',
    checked: theme === 'ulysses',
    click (menuItem, browserWindow) {
      actions.selectTheme('ulysses')
    }
  }]
}
