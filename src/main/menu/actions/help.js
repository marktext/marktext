export const showAboutDialog = win => {
  if (win && win.webContents) {
    win.webContents.send('AGANI::about-dialog')
  }
}

export const showTweetDialog = (win, type) => {
  if (win && win.webContents) {
    win.webContents.send('AGANI::tweet', type)
  }
}
