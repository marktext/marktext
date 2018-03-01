export const view = (win, item, type) => {
  const { checked } = item
  win.webContents.send('AGANI::view', { type, checked })
}
