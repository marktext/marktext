import { log } from '../utils'
import userPreference from '../preference'
import { windows } from '../createWindow'

export const selectTheme = (theme, themeCSS) => {
  userPreference.setItem('theme', theme)
    .then(() => {
      for (const win of windows.values()) {
        win.webContents.send('AGANI::user-preference', { theme })
      }
    })
    .catch(log)
}
