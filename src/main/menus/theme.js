import * as actions from '../actions/theme'
import userPreference from '../preference'

const { theme } = userPreference.getAll()

export default {
  label: 'Theme',
  id: 'themeMenu',
  submenu: [{
    label: 'Cadmium Light',
    type: 'radio',
    id: 'light',
    checked: theme === 'light',
    click (menuItem, browserWindow) {
      actions.selectTheme('light')
    }
  }, {
    label: 'Dark',
    type: 'radio',
    id: 'dark',
    checked: theme === 'dark',
    click (menuItem, browserWindow) {
      actions.selectTheme('dark')
    }
  }, {
    label: 'Graphite Light',
    type: 'radio',
    id: 'graphite',
    checked: theme === 'graphite',
    click (menuItem, browserWindow) {
      actions.selectTheme('graphite')
    }
  }, {
    label: 'Material Dark',
    type: 'radio',
    id: 'material-dark',
    checked: theme === 'material-dark',
    click (menuItem, browserWindow) {
      actions.selectTheme('material-dark')
    }
  }, {
    label: 'One Dark',
    type: 'radio',
    id: 'one-dark',
    checked: theme === 'one-dark',
    click (menuItem, browserWindow) {
      actions.selectTheme('one-dark')
    }
  }, {
    label: 'Ulysses Light',
    type: 'radio',
    id: 'ulysses',
    checked: theme === 'ulysses',
    click (menuItem, browserWindow) {
      actions.selectTheme('ulysses')
    }
  }]
}
