export default function (keybindings) {
  return {
    label: 'Edit',
    submenu: [{
      label: 'Cut',
      accelerator: keybindings.getAccelerator('editCut'),
      role: 'cut'
    }, {
      label: 'Copy',
      accelerator: keybindings.getAccelerator('editCopy'),
      role: 'copy'
    }, {
      label: 'Paste',
      accelerator: keybindings.getAccelerator('editPaste'),
      role: 'paste'
    }, {
      type: 'separator'
    }, {
      label: 'Select All',
      accelerator: keybindings.getAccelerator('editSelectAll'),
      role: 'selectAll'
    }]
  }
}
