export const showAboutDialog = win => {
  win.webContents.send('AGANI::about-dialog')
}
