export const showAboutDialog = win => {
  win.webContents.send('AGANI::about-dialog')
}

export const showTweetDialog = (win, type) => {
  win.webContents.send('AGANI::tweet', type)
}
