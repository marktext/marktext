import bus from '../../bus'

export const newFile = (menuItem, browserWindow) => {
  bus.$emit('SIDEBAR::new', 'file')
}

export const newDirectory = (menuItem, browserWindow) => {
  bus.$emit('SIDEBAR::new', 'directory')
}

export const copy = (menuItem, browserWindow) => {
  bus.$emit('SIDEBAR::copy-cut', 'copy')
}

export const cut = (menuItem, browserWindow) => {
  bus.$emit('SIDEBAR::copy-cut', 'cut')
}

export const paste = (menuItem, browserWindow) => {
  bus.$emit('SIDEBAR::paste')
}

export const rename = (menuItem, browserWindow) => {
  bus.$emit('SIDEBAR::rename')
}

export const remove = (menuItem, browserWindow) => {
  bus.$emit('SIDEBAR::remove')
}

export const showInFolder = (menuItem, browserWindow) => {
  bus.$emit('SIDEBAR::show-in-folder')
}
