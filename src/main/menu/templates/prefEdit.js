export default function (keybindings) {
  return {
    label: 'Edit',
    submenu: [{
      label: 'Cut',
      accelerator: keybindings.getAccelerator('edit.cut'),
      role: 'cut'
    }, {
      label: 'Copy',
      accelerator: keybindings.getAccelerator('edit.copy'),
      role: 'copy'
    }, {
      label: 'Paste',
      accelerator: keybindings.getAccelerator('edit.paste'),
      role: 'paste'
    }, {
      type: 'separator'
    }, {
      label: 'Select All',
      accelerator: keybindings.getAccelerator('edit.select-all'),
      role: 'selectAll'
    }]
  }
}
