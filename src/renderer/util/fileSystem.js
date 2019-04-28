import path from 'path'
import fse from 'fs-extra'

export const create = (pathname, type) => {
  if (type === 'directory') {
    return fse.ensureDir(pathname)
  } else {
    return fse.outputFile(pathname, '')
  }
}

export const paste = ({ src, dest, type }) => {
  return type === 'cut' ? fse.move(src, dest) : fse.copy(src, dest)
}

export const rename = (src, dest) => {
  return fse.move(src, dest)
}

/**
 * Check if the both paths point to the same file.
 *
 * @param {*} pathA The first path.
 * @param {*} pathB The second path.
 * @param {*} isNormalized Are both paths already normalized.
 */
export const isSameFileSync = (pathA, pathB, isNormalized=false) => {
  if (!pathA || !pathB) return false
  const a = isNormalized ? pathA : path.normalize(pathA)
  const b = isNormalized ? pathB : path.normalize(pathB)
  if (a.length !== b.length) {
    return false
  } else if (a === b) {
    return true
  } else if (a.toLowerCase() === b.toLowerCase()) {
    try {
      const fiA = fse.statSync(a)
      const fiB = fse.statSync(b)
      return fiA.ino === fiB.ino
    } catch (_) {
      // Ignore error
    }
  }
  return false
}
