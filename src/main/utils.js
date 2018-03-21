import fs from 'fs'
import path from 'path'
import { app, Menu } from 'electron'

export const getPath = directory => {
  return app.getPath(directory)
}

export const getMenuItem = menuName => {
  const menus = Menu.getApplicationMenu()
  return menus.items.find(menu => menu.label === menuName)
}

export const log = data => {
  if (typeof data !== 'string') data = (data.stack || data).toString()
  const LOG_DATA_PATH = path.join(getPath('userData'), 'error.log')
  const LOG_TIME = new Date().toLocaleString()
  fs.appendFileSync(LOG_DATA_PATH, `\n${LOG_TIME}\n${data}\n`)
}
