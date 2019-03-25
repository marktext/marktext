import fs from 'fs'
import path from 'path'
import fse from 'fs-extra'
import { app, Menu } from 'electron'
import { EXTENSIONS } from '../config'

const ID_PREFIX = 'mt-'
let id = 0

export const getUniqueId = () => {
  return `${ID_PREFIX}${id++}`
}

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

export const getRecommendTitle = markdown => {
  const tokens = markdown.match(/#{1,6} {1,}(.+)(?:\n|$)/g)
  if (!tokens) return ''
  let headers = tokens.map(t => {
    const matches = t.trim().match(/(#{1,6}) {1,}(.+)/)
    return {
      level: matches[1].length,
      content: matches[2].trim()
    }
  })
  return headers.sort((a, b) => a.level - b.level)[0].content
}

export const getPath = directory => {
  return app.getPath(directory)
}

export const getMenuItemById = menuId => {
  const menus = Menu.getApplicationMenu()
  return menus.getMenuItemById(menuId)
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
  if (!filename || typeof filename !== 'string') return false
  return EXTENSIONS.some(ext => filename.endsWith(`.${ext}`))
}

export const hasSameKeys = (a, b) => {
  const aKeys = Object.keys(a).sort()
  const bKeys = Object.keys(b).sort()
  return JSON.stringify(aKeys) === JSON.stringify(bKeys)
}

/**
 * Returns true if the path is a directory with read access.
 *
 * @param {string} dirPath The directory path.
 */
export const isDirectory = dirPath => {
  try {
    return fs.existsSync(dirPath) && fs.lstatSync(dirPath).isDirectory()
  } catch (e) {
    return false
  }
}

/**
 * Returns true if the path is a file with read access.
 *
 * @param {string} filepath The file path.
 */
export const isFile = filepath => {
  try {
    return fs.existsSync(filepath) && fs.lstatSync(filepath).isFile()
  } catch (e) {
    return false
  }
}

/**
 * Returns true if the path is a symbolic link with read access.
 *
 * @param {string} filepath The link path.
 */
export const isSymbolicLink = filepath => {
  try {
    return fs.existsSync(filepath) && fs.lstatSync(filepath).isSymbolicLink()
  } catch (e) {
    return false
  }
}

/**
 * Returns true if the path is a markdown file.
 *
 * @param {string} filepath The path or link path.
 */
export const isMarkdownFile = filepath => {
  return isFile(filepath) && hasMarkdownExtension(filepath)
}

/**
 * Returns true if the path is a markdown file or symbolic link to a markdown file.
 *
 * @param {string} filepath The path or link path.
 */
export const isMarkdownFileOrLink = filepath => {
  if (!isFile(filepath)) return false
  if (hasMarkdownExtension(filepath)) {
    return true
  }

  // Symbolic link to a markdown file
  if (isSymbolicLink(filepath)) {
    const targetPath = fs.readlinkSync(filepath)
    return isFile(targetPath) && hasMarkdownExtension(targetPath)
  }
  return false
}

/**
 * Normalize the path into an absolute path and resolves the link target if needed.
 *
 * @param {string} pathname The path or link path.
 * @returns {string} Returns the absolute path and resolved link. If the link target
 *                   cannot be resolved, an empty string is returned.
 */
export const normalizeAndResolvePath = pathname => {
  if (isSymbolicLink(pathname)) {
    const absPath = path.dirname(pathname)
    const targetPath = path.resolve(absPath, fs.readlinkSync(pathname))
    if (isFile(targetPath) || isDirectory(targetPath)) {
      return path.resolve(targetPath)
    }
    console.error(`Cannot resolve link target "${pathname}" (${targetPath}).`)
    return ''
  }
  return path.resolve(pathname)
}

export const readJson = (filePath, printError) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  } catch (e) {
    if (printError) console.log(e)
    return null
  }
}
