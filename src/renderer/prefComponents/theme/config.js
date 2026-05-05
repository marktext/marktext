export const themes = [
  {
    name: 'light'
  },
  {
    name: 'dark'
  },
  {
    name: 'graphite'
  },
  {
    name: 'material-dark'
  },
  {
    name: 'ulysses'
  },
  {
    name: 'one-dark'
  }
]

export const autoSwitchThemeOptions = (t) => [{
  label: t('pref.theme.autoSwitch.startup'),
  value: 0
}, /* {
  label: 'Only at runtime',
  value: 1
}, */ {
  label: t('pref.theme.autoSwitch.never'),
  value: 2
}]
