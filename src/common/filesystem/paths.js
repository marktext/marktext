import fs from 'fs-extra'
import path from 'path'
import { isFile, isSymbolicLink } from './index'

export const MARKDOWN_EXTENSIONS = [
  'markdown',
  'mdown',
  'mkdn',
  'md',
  'mkd',
  'mdwn',
  'mdtxt',
  'mdtext',
  'text',
  'txt'
]

export const IMAGE_EXTENSIONS = [
  'jpeg',
  'jpg',
  'png',
  'gif',
  'svg',
  'webp'
]

/**
 * Returns true if the filename matches one of the markdown extensions.
 *
 * @param {string} filename Path or filename
 */
export const hasMarkdownExtension = filename => {
  if (!filename || typeof filename !== 'string') return false
  return MARKDOWN_EXTENSIONS.some(ext => filename.endsWith(`.${ext}`))
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
 * Check if the both paths point to the same file.
 *
 * @param {string} pathA The first path.
 * @param {string} pathB The second path.
 * @param {boolean} [isNormalized] Are both paths already normalized.
 */
export const isSamePathSync = (pathA, pathB, isNormalized = false) => {
  if (!pathA || !pathB) return false
  const a = isNormalized ? pathA : path.normalize(pathA)
  const b = isNormalized ? pathB : path.normalize(pathB)
  if (a.length !== b.length) {
    return false
  } else if (a === b) {
    return true
  } else if (a.toLowerCase() === b.toLowerCase()) {
    try {
      const fiA = fs.statSync(a)
      const fiB = fs.statSync(b)
      return fiA.ino === fiB.ino
    } catch (_) {
      // Ignore error
    }
  }
  return false
}

/**
 * Check whether a file or directory is a child of the given directory.
 *
 * @param {string} dir The parent directory.
 * @param {string} child The file or directory path to check.
 */
export const isChildOfDirectory = (dir, child) => {
  if (!dir || !child) return false
  const relative = path.relative(dir, child)
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
}
