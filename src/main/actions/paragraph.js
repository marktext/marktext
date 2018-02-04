export const paragraph = (win, type) => {
  win.webContents.send('AGANI::paragraph', { type })
}
