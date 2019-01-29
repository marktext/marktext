import keybindings from '../shortcutHandler'

export default {
  label: 'Window',
  role: 'window',
  submenu: [{
    label: 'Minimize',
    accelerator: keybindings.getAccelerator('windowMinimize'),
    role: 'minimize'
  }, {
    label: 'Close Window',
    accelerator: keybindings.getAccelerator('windowCloseWindow'),
    role: 'close'
  }]
}
