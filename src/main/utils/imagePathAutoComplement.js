import fs from 'fs'
import path from 'path'
import { filter } from 'fuzzaldrin'
import { isDirectory, isFile, log } from './index'
import { IMAGE_EXTENSIONS, BLACK_LIST } from '../config'

// TODO: rebuild cache @jocs
const IMAGE_PATH = new Map()
export const watchers = new Map()

const filesHandler = (files, directory, key) => {
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
      return {
        file,
        type
      }
    })
    .filter(({
      file,
      type
    }) => {
      if (BLACK_LIST.includes(file)) return false
      return type === 'directory' || type === 'image'
    })

  IMAGE_PATH.set(directory, onlyDirAndImage)
  if (key !== undefined) {
    return filter(onlyDirAndImage, key, {
      key: 'file'
    })
  }
}

const rebuild = (directory) => {
  fs.readdir(directory, (err, files) => {
    if (err) log(err)
    else {
      filesHandler(files, directory)
    }
  })
}

const watchDirectory = directory => {
  if (watchers.has(directory)) return // Do not duplicate watch the same directory
  const watcher = fs.watch(directory, (eventType, filename) => {
    if (eventType === 'rename') {
      rebuild(directory)
    }
  })
  watchers.set(directory, watcher)
}

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
          result = filesHandler(files, directory, key)
          watchDirectory(directory)
          resolve(result)
        }
      })
    })
  }
}
