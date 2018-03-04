import fs from 'fs'
import path from 'path'
import { ipcMain, BrowserWindow } from 'electron'
import { getMenuItem } from '../utils'
/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */

if (process.env.NODE_ENV !== 'development') {
  global.__static = require('path').join(__dirname, '/static').replace(/\\/g, '\\\\')
}

const THEME_PATH = path.join(__static, '/themes')

const themeCSS = {}

export const selectTheme = (win, theme, themeCSS) => {
  win.webContents.send('AGANI::theme', { theme, themeCSS })
}

const getSelectTheme = () => {
  const themeMenu = getMenuItem('Theme')
  return themeMenu.submenu.items.find(item => item.checked)
}

ipcMain.on('AGANI::ask-for-theme', e => {
  const win = BrowserWindow.fromWebContents(e.sender)
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
        selectTheme(win, selectedTheme, themeCSS)
      })
  } else {
    const selectedTheme = getSelectTheme().label.toLowerCase()
    selectTheme(win, selectedTheme, themeCSS)
  }
})
