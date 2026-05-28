import { type MenuItemConstructorOptions } from 'electron'
import { t } from '../../i18n'
import type Keybindings from '../../keyboard/shortcutHandler'

export default function(keybindings: Keybindings): MenuItemConstructorOptions {
  return {
    label: t('menu.edit.edit'),
    submenu: [
      {
        label: t('menu.edit.cut'),
        accelerator: keybindings.getAccelerator('edit.cut') ?? undefined,
        role: 'cut'
      },
      {
        label: t('menu.edit.copy'),
        accelerator: keybindings.getAccelerator('edit.copy') ?? undefined,
        role: 'copy'
      },
      {
        label: t('menu.edit.paste'),
        accelerator: keybindings.getAccelerator('edit.paste') ?? undefined,
        role: 'paste'
      },
      {
        type: 'separator'
      },
      {
        label: t('menu.edit.selectAll'),
        accelerator: keybindings.getAccelerator('edit.select-all') ?? undefined,
        role: 'selectAll'
      }
    ]
  }
}
