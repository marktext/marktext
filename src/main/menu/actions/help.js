export const showAboutDialog = win => {
  win.webContents.send('mt::about-dialog')
}

export const showTweetDialog = (win, type) => {
  win.webContents.send('mt::tweet', type)
}
