import fs from 'fs'
import path from 'path'
import { isFile, isFile2, isSymbolicLink } from './index'
import { minimatch } from 'minimatch'

const isOsx = process.platform === 'darwin'

export const MARKDOWN_EXTENSIONS: readonly string[] = Object.freeze([
  'markdown',
  'mdown',
  'mkdn',
  'md',
  'mkd',
  'mdwn',
  'mdtxt',
  'mdtext',
  'mdx',
  'text',
  'txt'
])

export const MARKDOWN_INCLUSIONS: readonly string[] = Object.freeze(
  MARKDOWN_EXTENSIONS.map((x) => '*.' + x)
)

export const IMAGE_EXTENSIONS: readonly string[] = Object.freeze([
  'jpeg',
  'jpg',
  'png',
  'gif',
  'svg',
  'webp'
])

/**
 * Returns true if the filename matches one of the markdown extensions.
 */
export const hasMarkdownExtension = (filename: string): boolean => {
  if (!filename || typeof filename !== 'string') return false
  return MARKDOWN_EXTENSIONS.some((ext) => filename.toLowerCase().endsWith(`.${ext}`))
}

/**
 * Returns true if the path is an image file.
 */
export const isImageFile = (filepath: string): boolean => {
  const ext = path.extname(filepath).slice(1).toLowerCase()
  return !!ext && IMAGE_EXTENSIONS.includes(ext) && isFile(filepath)
}

/**
 * Returns true if the path is a markdown file or symbolic link to one.
 */
export const isMarkdownFile = (filepath: string): boolean => {
  if (!isFile2(filepath)) return false

  if (isSymbolicLink(filepath)) {
    const targetPath = path.resolve(path.dirname(filepath), fs.readlinkSync(filepath))
    return isFile(targetPath) && hasMarkdownExtension(targetPath)
  }
  return hasMarkdownExtension(filepath)
}

/**
 * Check if the both paths point to the same file.
 */
export const isSamePathSync = (
  pathA: string,
  pathB: string,
  isNormalized: boolean = false
): boolean => {
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
    } catch {
      // Ignore stat errors and fall through.
    }
  }
  return false
}

/**
 * Check whether a file or directory is a child of the given directory.
 */
export const isChildOfDirectory = (dir: string, child: string): boolean => {
  if (!dir || !child) return false
  const relative = path.relative(dir, child)
  return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative)
}

export const getResourcesPath = (): string => {
  let resPath = process.resourcesPath
  if (process.env.NODE_ENV === 'development') {
    // Default locations:
    //   Linux/Windows: node_modules/electron/dist/resources/
    //   macOS: node_modules/electron/dist/Electron.app/Contents/Resources
    if (isOsx) {
      resPath = path.join(resPath, '../..')
    }
    resPath = path.join(resPath, '../../../../resources')
  }
  return resPath
}

/**
 * Returns true if the pathname matches one of the exclude patterns.
 */
export const checkPathExcludePattern = (pathname: string, patterns: readonly string[]): boolean => {
  if (!pathname || typeof pathname !== 'string') return false
  for (const pattern of patterns) {
    if (minimatch(pathname, pattern, { matchBase: true })) {
      return true
    }
  }
  return false
}
