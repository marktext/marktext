import fse from 'fs-extra'

export const create = (pathname, type) => {
  if (type === 'directory') {
    return fse.ensureDir(pathname)
  } else {
    return fse.outputFile(pathname, '')
  }
}

export const paste = ({ src, dest, type }) => {
  console.log(src, dest)
  return type === 'cut' ? fse.move(src, dest) : fse.copy(src, dest)
}
