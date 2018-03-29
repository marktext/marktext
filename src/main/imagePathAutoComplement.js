import fs from 'fs'
import path from 'path'
import { filter } from 'fuzzaldrin'
import { isDirectory, isFile } from './utils'
import { IMAGE_EXTENSIONS, BLACK_LIST } from './config'

// TODO: rebuild cache @jocs
const IMAGE_PATH = new Map()

export const searchFilesAndDir = (directory, key) => {
  let result = []
  if (IMAGE_PATH.has(directory)) {
    result = filter(IMAGE_PATH.get(directory), key, { key: 'file' })
    return Promise.resolve(result)
  } else {
    return new Promise((resolve, reject) => {
      fs.readdir(directory, (err, files) => {
        if (err) reject(err)
        else {
          const IMAGE_REG = new RegExp('(' + IMAGE_EXTENSIONS.join('|') + ')$', 'i')
          const onlyDirAndImage = files
            .map(file => {
              const fullPath = path.join(directory, file)
              let type = ''
              if (isDirectory(fullPath)) {
                type = 'directory'
              } else if (isFile(fullPath) && IMAGE_REG.test(file)) {
                type = 'image'
              }
              return { file, type }
            })
            .filter(({ file, type }) => {
              if (BLACK_LIST.includes(file)) return false
              return type === 'directory' || type === 'image'
            })
          result = filter(onlyDirAndImage, key, { key: 'file' })
          IMAGE_PATH.set(directory, onlyDirAndImage)
          resolve(result)
        }
      })
    })
  }
}
