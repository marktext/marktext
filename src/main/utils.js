import { Menu } from 'electron'

export const getMenuItem = menuName => {
  const menus = Menu.getApplicationMenu()
  console.log(typeof menus.append)
  return menus.items.find(menu => menu.label === menuName)
}
