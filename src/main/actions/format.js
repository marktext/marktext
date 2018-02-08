export const format = (win, type) => {
  win.webContents.send('AGANI::format', { type })
}
