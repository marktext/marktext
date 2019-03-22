import * as actions from '../actions/theme'
import userPreference from '../preference'

const { theme } = userPreference.getAll()

export default {
  label: 'Theme',
  id: 'themeMenu',
  submenu: [{
    label: 'Mateial Dark',
    type: 'radio',
    id: 'dark',
    checked: theme === 'dark',
    click (menuItem, browserWindow) {
      actions.selectTheme('dark')
    }
  }, {
    label: 'Cadmium Light',
    type: 'radio',
    id: 'light',
    checked: theme === 'light',
    click (menuItem, browserWindow) {
      actions.selectTheme('light')
    }
  }, {
    label: 'Ulysses Light',
    type: 'radio',
    id: 'ulysses',
    checked: theme === 'ulysses',
    click (menuItem, browserWindow) {
      actions.selectTheme('ulysses')
    }
  }, {
    label: 'Graphite Light',
    type: 'radio',
    id: 'graphite',
    checked: theme === 'graphite',
    click (menuItem, browserWindow) {
      actions.selectTheme('graphite')
    }
  }]
}
