export const undo = win => {
  win.webContents.send('AGANI::undo')
}
