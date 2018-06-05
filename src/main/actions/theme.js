import { log } from '../utils'
import userPreference from '../preference'
import appWindow from '../window'

export const selectTheme = (theme, themeCSS) => {
  userPreference.setItem('theme', theme)
    .then(() => {
      for (const { win } of appWindow.windows.values()) {
        win.webContents.send('AGANI::user-preference', { theme })
      }
    })
    .catch(log)
}
