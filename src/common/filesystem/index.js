import fs from 'fs-extra'

/**
 * Test whether or not the given path exists.
 *
 * @param {string} p The path to the file or directory.
 * @returns {boolean}
 */
export const exists = async p => {
  // Nodes fs.exists is deprecated.
  try {
    await fs.access(p)
    return true
  } catch(_) {
    return false
  }
}

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
