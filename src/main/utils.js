import fs from 'fs'
import path from 'path'
import fse from 'fs-extra'
import { app, Menu } from 'electron'
import { EXTENSIONS } from './config'

// creates a directory if it doesn't already exist.
export const ensureDir = dirPath => {
  try {
    fse.ensureDirSync(dirPath)
  } catch (e) {
    if (e.code !== 'EEXIST') {
      throw e
    }
  }
}

export const getPath = directory => {
  return app.getPath(directory)
}

export const getMenuItem = menuName => {
  const menus = Menu.getApplicationMenu()
  return menus.items.find(menu => menu.label === menuName)
}

export const log = data => {
  if (typeof data !== 'string') data = (data.stack || data).toString()
  const LOG_DATA_PATH = path.join(getPath('userData'), 'error.log')
  const LOG_TIME = new Date().toLocaleString()
  ensureDir(getPath('userData'))
  fs.appendFileSync(LOG_DATA_PATH, `\n${LOG_TIME}\n${data}\n`)
}

// returns true if the filename matches one of the markdown extensions
export const hasMarkdownExtension = filename => {
  const extension = path.extname(filename).split('.').pop()
  if (extension) {
    return EXTENSIONS.indexOf(extension) >= 0
  }
  return false
}

export const hasSameKeys = (a, b) => {
  const aKeys = Object.keys(a).sort()
  const bKeys = Object.keys(b).sort()
  return JSON.stringify(aKeys) === JSON.stringify(bKeys)
}

export const isDirectory = dirPath => {
  try {
    return fs.existsSync(dirPath) && fs.lstatSync(dirPath).isDirectory()
  } catch (e) {
    // No permissions
    return false
  }
}

// returns true if the path is a file with read access.
export const isFile = filepath => {
  try {
    return fs.existsSync(filepath) && fs.lstatSync(filepath).isFile()
  } catch (e) {
    // No permissions
    return false
  }
}

// returns true if the file is a supported markdown file.
export const isMarkdownFile = filepath => {
  return isFile(filepath) && hasMarkdownExtension(filepath)
}
