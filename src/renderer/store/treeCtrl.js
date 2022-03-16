import path from 'path'
import { getUniqueId } from '../util'
import { PATH_SEPARATOR } from '../config'

export const PROJECT_UPDATE_POLICY = Object.freeze({
  /** Mode to only update loaded entries in the project tree (e.g. used by filesystem watcher). */
  PARTIAL: 0,
  /** Mode to update the project tree even when the entry was not yet loaded (e.g. used to load new sub-entries). */
  FORCE: 1
})

/**
 * Return all sub-directories relative to the root directory.
 *
 * @param {string} rootPath Root directory path
 * @param {string} pathname Full directory path
 * @returns {Array<string>} Sub-directories relative to root.
 */
const getSubdirectoriesFromRoot = (rootPath, pathname) => {
  if (!path.isAbsolute(pathname)) {
    throw new Error('Path in project tree must be absolute.')
  }
  const relativePath = path.relative(rootPath, pathname)
  return relativePath ? relativePath.split(PATH_SEPARATOR) : []
}

/**
 * Add a new file to the tree list.
 *
 * @param {*} tree Root file tree
 * @param {String} fullPath The file path that should be added
 * @param {*} policy The update policy
 */
export const addFile = (tree, fullPath, policy) => {
  const dirname = path.dirname(fullPath)
  const filename = path.basename(fullPath)

  const currentFolder = createDirectoryIfAbsent(tree, dirname, policy)
  if (!currentFolder || !isAllowedToCreate(currentFolder, policy)) {
    // Ignore event because parent directory wasn't visited yet.
    return
  }

  const isFileEntryAbsent = currentFolder.files.findIndex(f => f.name === filename) === -1
  if (isFileEntryAbsent) {
    const fileEntry = {
      id: getUniqueId(),
      pathname: fullPath,
      name: filename,
      isFile: true
    }

    const index = currentFolder.files.findIndex(f => f.name.localeCompare(filename) > 0)
    if (index !== -1) {
      currentFolder.files.splice(index, 0, fileEntry)
    } else {
      currentFolder.files.push(fileEntry)
    }
  }
}

/**
 * Add a new directory to the tree list.
 *
 * @param {*} tree Root file tree
 * @param {String} fullPath The directory path that should be added
 * @param {*} policy The update policy
 */
export const addDirectory = (tree, fullPath, policy) => {
  createDirectoryIfAbsent(tree, fullPath, policy)
}

/**
 * Add a new directory to the tree list.
 *
 * @param {*} tree Root file tree
 * @param {String} fullPath The directory path that should be added
 * @param {*} policy The update policy
 * @returns The folder entry for the added directory path or null if no directories
 *          should be created by policy (e.g. file watcher).
 */
const createDirectoryIfAbsent = (tree, fullPath, policy) => {
  const subDirectories = getSubdirectoriesFromRoot(tree.pathname, fullPath)

  let currentFolderEntry = tree
  let currentPath = tree.pathname
  let currentSubFolders = tree.folders
  for (const directoryName of subDirectories) {
    let childFolder = currentSubFolders.find(f => f.name === directoryName)
    if (!isAllowedToCreate(currentFolderEntry, policy)) {
      return null
    }

    if (!childFolder) {
      childFolder = {
        id: getUniqueId(),
        pathname: `${currentPath}${PATH_SEPARATOR}${directoryName}`,
        name: directoryName,
        isDirectory: true,
        isCollapsed: true,
        isLoaded: false,
        folders: [],
        files: []
      }

      const index = currentSubFolders.findIndex(d => d.name.localeCompare(directoryName) > 0)
      if (index !== -1) {
        currentSubFolders.splice(index, 0, childFolder)
      } else {
        currentSubFolders.push(childFolder)
      }
    }

    currentPath = `${currentPath}${PATH_SEPARATOR}${directoryName}`
    currentSubFolders = childFolder.folders
    currentFolderEntry = childFolder
  }
  return currentFolderEntry
}

// Check whether we should create all entries (full mode) or
// only updated visited entries (partial mode).
const isAllowedToCreate = (folderEntry, policy) => {
  if (policy === PROJECT_UPDATE_POLICY.FORCE) {
    return true
  }
  return folderEntry.isLoaded
}

/**
 * Remove the given file from the tree list.
 *
 * @param {*} tree Root file tree
 * @param {String} pathname The file path that should be deleted
 */
export const unlinkFile = (tree, pathname) => {
  const dirname = path.dirname(pathname)
  const subDirectories = getSubdirectoriesFromRoot(tree.pathname, dirname)

  let currentFolder = tree
  let currentSubFolders = tree.folders
  for (const directoryName of subDirectories) {
    const childFolder = currentSubFolders.find(f => f.name === directoryName)
    if (!childFolder) {
      return
    }
    currentFolder = childFolder
    currentSubFolders = childFolder.folders
  }

  const index = currentFolder.files.findIndex(f => f.pathname === pathname)
  if (index !== -1) {
    currentFolder.files.splice(index, 1)
  }
}

/**
 * Remove the given directory from the tree list.
 *
 * @param {*} tree Root file tree
 * @param {String} pathname The directory path that should be deleted
 */
export const unlinkDirectory = (tree, pathname) => {
  const subDirectories = getSubdirectoriesFromRoot(tree.pathname, pathname)
  subDirectories.pop()

  let currentFolder = tree.folders
  for (const directoryName of subDirectories) {
    const childFolder = currentFolder.find(f => f.name === directoryName)
    if (!childFolder) {
      return
    }
    currentFolder = childFolder.folders
  }

  const index = currentFolder.findIndex(f => f.pathname === pathname)
  if (index !== -1) {
    currentFolder.splice(index, 1)
  }
}
