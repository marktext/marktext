export const edit = (win, type) => {
  win.webContents.send('AGANI::edit', { type })
}
