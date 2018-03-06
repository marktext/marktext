import * as actions from '../actions/theme'

export default {
  label: 'Theme',
  submenu: [{
    label: 'Dark',
    type: 'radio',
    checked: false,
    click (menuItem, browserWindow) {
      actions.selectTheme(browserWindow, 'dark')
    }
  }, {
    label: 'Light',
    type: 'radio',
    checked: true,
    click (menuItem, browserWindow) {
      actions.selectTheme(browserWindow, 'light')
    }
  }]
}
