import fs from 'fs'
import path from 'path'
import { ipcMain, BrowserWindow } from 'electron'
import { getMenuItem } from '../utils'

const THEME_PATH = path.resolve(__dirname, '../../editor/themes')
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
          console.log(t)
          const { theme, data } = t
          themeCSS[theme] = data
        })
        const selectedTheme = getSelectTheme().label.toLowerCase()
        console.log(selectedTheme)
        console.log(themeCSS)
        selectTheme(win, selectedTheme, themeCSS)
      })
  } else {
    const selectedTheme = getSelectTheme().label.toLowerCase()
    selectTheme(win, selectedTheme, themeCSS)
  }
})
