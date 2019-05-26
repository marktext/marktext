import fs from 'fs-extra'
import path from 'path'
import { hasMarkdownExtension } from '../utils'
import { IMAGE_EXTENSIONS } from '../config'

/**
 * Ensure that a directory exist.
 *
 * @param {string} dirPath The directory path.
 */
export const ensureDirSync = dirPath => {
  try {
    fs.ensureDirSync(dirPath)
  } catch (e) {
    if (e.code !== 'EEXIST') {
      throw e
    }
  }
}

/**
 * Returns true if the path is a directory with read access.
 *
 * @param {string} dirPath The directory path.
 */
export const isDirectory = dirPath => {
  try {
    return fs.existsSync(dirPath) && fs.lstatSync(dirPath).isDirectory()
  } catch (_) {
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
  } catch (_) {
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
  } catch (_) {
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
 * Returns ture if the path is an image file.
 * 
 * @param {string} filepath The path
 */
export const isImageFile = filepath => {
  const extname = path.extname(filepath)
  return isFile(filepath) && IMAGE_EXTENSIONS.some(ext => {
    const EXT_REG = new RegExp(ext, 'i')
    return EXT_REG.test(extname)
  })
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

export const writeFile = (pathname, content, extension) => {
  if (!pathname) {
    return Promise.reject('[ERROR] Cannot save file without path.')
  }
  pathname = !extension || pathname.endsWith(extension) ? pathname : `${pathname}${extension}`

  return fs.outputFile(pathname, content, 'utf-8')
}
