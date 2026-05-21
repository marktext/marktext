export const showAboutDialog = win => {
  if (win && win.webContents) {
    win.webContents.send('mt::about-dialog')
  }
}
