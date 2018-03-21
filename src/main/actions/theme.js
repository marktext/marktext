import fs from 'fs'
import path from 'path'
import { ipcMain } from 'electron'
import { getMenuItem, log } from '../utils'
import userPreference from '../preference'
import { windows } from '../createWindow'

const THEME_PATH = path.join(__static, '/themes')

const themeCSS = {}

export const selectTheme = (theme, themeCSS) => {
  userPreference.setItem('theme', theme)
    .then(() => {
      for (const win of windows.values()) {
        win.webContents.send('AGANI::theme', { theme, themeCSS })
      }
    })
    .catch(log)
}

const getSelectTheme = () => {
  const themeMenu = getMenuItem('Theme')
  return themeMenu.submenu.items.find(item => item.checked)
}

ipcMain.on('AGANI::ask-for-theme', e => {
  // const win = BrowserWindow.fromWebContents(e.sender)
  if (!Object.keys(themeCSS).length) {
    const promises = ['dark', 'light'].map(theme => {
      return new Promise((resolve, reject) => {
        fs.readFile(`${THEME_PATH}/${theme}.css`, 'utf-8', (err, data) => {
          if (err) reject(err)
          resolve({ theme, data })
        })
      })
    })
    Promise.all(promises)
      .then(themes => {
        themes.forEach(t => {
          const { theme, data } = t
          themeCSS[theme] = data
        })
        const selectedTheme = getSelectTheme().label.toLowerCase()
        selectTheme(selectedTheme, themeCSS)
      })
      .catch(log)
  } else {
    const selectedTheme = getSelectTheme().label.toLowerCase()
    selectTheme(selectedTheme, themeCSS)
  }
})
