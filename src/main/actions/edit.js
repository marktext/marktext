import { dialog } from 'electron'
import { IMAGE_EXTENSIONS } from '../config'

export const edit = (win, type) => {
  win.webContents.send('AGANI::edit', { type })
}

export const insertImage = (win, type) => {
  if (type === 'absolute' || type === 'relative') {
    const filename = dialog.showOpenDialog(win, {
      properties: [ 'openFile' ],
      filters: [{
        name: 'Images',
        extensions: IMAGE_EXTENSIONS
      }]
    })
    if (filename && filename[0]) {
      win.webContents.send('AGANI::INSERT_IMAGE', { filename: filename[0], type })
    }
  } else {
    win.webContents.send('AGANI::INSERT_IMAGE', { type })
  }
}
