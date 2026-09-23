import { access } from 'fs/promises'
import { accessSync, constants, lstatSync, readlinkSync, statSync } from 'fs'
import { resolve, dirname } from 'path'
import { ensureDirSync as fsExtraEnsureDirSync } from 'fs-extra'

/**
 * Test whether or not the given path exists.
 */
export const exists = async(p: string): Promise<boolean> => {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

/**
 * Ensure that a directory exists.
 */
export const ensureDirSync = (dirPath: string): void => {
  try {
    fsExtraEnsureDirSync(dirPath)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw e
    }
  }
}

/**
 * Returns true if the path is a directory with read access.
 */
export const isDirectory = (dirPath: string): boolean => {
  try {
    return lstatSync(dirPath).isDirectory()
  } catch {
    return false
  }
}

/**
 * Returns true if the path is a directory or a symbolic link to a directory
 * with read access.
 */
export const isDirectory2 = (dirPath: string): boolean => {
  try {
    const fi = lstatSync(dirPath)
    if (fi.isDirectory()) {
      return true
    } else if (fi.isSymbolicLink()) {
      const targetPath = resolve(dirname(dirPath), readlinkSync(dirPath))
      return isDirectory(targetPath)
    }
    return false
  } catch {
    return false
  }
}

/**
 * Returns true if the path is a file with read access.
 */
export const isFile = (filepath: string): boolean => {
  try {
    return lstatSync(filepath).isFile()
  } catch {
    return false
  }
}

/**
 * Returns true if the path is a file or a symbolic link to a file with read
 * access.
 */
export const isFile2 = (filepath: string): boolean => {
  try {
    const fi = lstatSync(filepath)
    if (fi.isFile()) {
      return true
    } else if (fi.isSymbolicLink()) {
      const targetPath = resolve(dirname(filepath), readlinkSync(filepath))
      return isFile(targetPath)
    }
    return false
  } catch {
    return false
  }
}

/**
 * Whether `filepath` is a file this process can execute. `access` rather than
 * the mode bits: only the owner bits count for the owner, so a file carrying
 * just the "other" bit looks executable to a bit test and gets EACCES at spawn.
 * On Windows `X_OK` has no effect, leaving the `isFile` half doing the work.
 */
export const isExecutableFile = (filepath: string): boolean => {
  try {
    if (!statSync(filepath).isFile()) return false
    accessSync(filepath, constants.X_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Returns true if the path is a symbolic link with read access.
 */
export const isSymbolicLink = (filepath: string): boolean => {
  try {
    return lstatSync(filepath).isSymbolicLink()
  } catch {
    return false
  }
}
