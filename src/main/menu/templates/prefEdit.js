import i18n from '../../i18n'

export default function (keybindings) {
  return {
    label: i18n.t('menu.edit._title_simple'),
    submenu: [{
      label: i18n.t('menu.edit.cut'),
      accelerator: keybindings.getAccelerator('edit.cut'),
      role: 'cut'
    }, {
      label: i18n.t('menu.edit.copy'),
      accelerator: keybindings.getAccelerator('edit.copy'),
      role: 'copy'
    }, {
      label: i18n.t('menu.edit.paste'),
      accelerator: keybindings.getAccelerator('edit.paste'),
      role: 'paste'
    }, {
      type: 'separator'
    }, {
      label: i18n.t('menu.edit.selectAll'),
      accelerator: keybindings.getAccelerator('edit.select-all'),
      role: 'selectAll'
    }]
  }
}
