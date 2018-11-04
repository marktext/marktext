import keybindings from '../shortcutHandler'

export default {
  label: 'Window',
  role: 'window',
  submenu: [{
    label: 'Minimize',
    accelerator: keybindings.get('windowMinimize'),
    role: 'minimize'
  }, {
    label: 'Close Window',
    accelerator: keybindings.get('windowCloseWindow'),
    role: 'close'
  }]
}
