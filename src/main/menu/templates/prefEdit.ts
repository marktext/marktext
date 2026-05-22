import { type MenuItemConstructorOptions } from 'electron'
import { t } from '../../i18n'
import type Keybindings from '../../keyboard/shortcutHandler'

export default function(keybindings: Keybindings): MenuItemConstructorOptions {
  return {
    label: t('menu.edit.edit'),
    submenu: [
      {
        label: t('menu.edit.cut'),
        ...keybindings.acceleratorFor('edit.cut'),
        role: 'cut'
      },
      {
        label: t('menu.edit.copy'),
        ...keybindings.acceleratorFor('edit.copy'),
        role: 'copy'
      },
      {
        label: t('menu.edit.paste'),
        ...keybindings.acceleratorFor('edit.paste'),
        role: 'paste'
      },
      {
        type: 'separator'
      },
      {
        label: t('menu.edit.selectAll'),
        ...keybindings.acceleratorFor('edit.select-all'),
        role: 'selectAll'
      }
    ]
  }
}
