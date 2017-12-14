export const undo = win => {
  win.webContents.send('AGANI::undo')
}
export const redo = win => {
  win.webContents.send('AGANI::redo')
}
