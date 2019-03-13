import path from 'path'
import { getUniqueId } from '../util'
import { PATH_SEPARATOR } from '../config'

/**
 * Return all sub-directories relative to the root directory.
 *
 * @param {string} rootPath Root directory path
 * @param {string} pathname Full directory path
 * @returns {Array<string>} Sub-directories relative to root.
 */
const getSubdirectoriesFromRoot = (rootPath, pathname) => {
  if (!path.isAbsolute(pathname)) {
    throw new Error('Invalid path!')
  }
  const relativePath = path.relative(rootPath, pathname)
  return relativePath ? relativePath.split(PATH_SEPARATOR) : []
}

/**
 * Add a new file to the tree list.
 *
 * @param {*} tree Root file tree
 * @param {*} file The file that should be added
 */
export const addFile = (tree, file) => {
  const { pathname, name } = file
  const dirname = path.dirname(pathname)
  const subDirectories = getSubdirectoriesFromRoot(tree.pathname, dirname)

  let currentPath = tree.pathname
  let currentFolder = tree
  let currentSubFolders = tree.folders
  for (const directoryName of subDirectories) {
    let childFolder = currentSubFolders.find(f => f.name === directoryName)
    if (!childFolder) {
      childFolder = {
        id: getUniqueId(),
        pathname: `${currentPath}${PATH_SEPARATOR}${directoryName}`,
        name: directoryName,
        isCollapsed: true,
        isDirectory: true,
        isFile: false,
        isMarkdown: false,
        folders: [],
        files: []
      }
      currentSubFolders.push(childFolder)
    }

    currentPath = `${currentPath}${PATH_SEPARATOR}${directoryName}`
    currentFolder = childFolder
    currentSubFolders = childFolder.folders
  }

  // Add file to related directory
  if (!currentFolder.files.find(f => f.name === name)) {
    file.id = getUniqueId()
    currentFolder.files.push(file)
  }
}

/**
 * Add a new directory to the tree list.
 *
 * @param {*} tree Root file tree
 * @param {*} dir The directory that should be added
 */
export const addDirectory = (tree, dir) => {
  const subDirectories = getSubdirectoriesFromRoot(tree.pathname, dir.pathname)

  let currentPath = tree.pathname
  let currentSubFolders = tree.folders
  for (const directoryName of subDirectories) {
    let childFolder = currentSubFolders.find(f => f.name === directoryName)
    if (!childFolder) {
      childFolder = {
        id: getUniqueId(),
        pathname: `${currentPath}${PATH_SEPARATOR}${directoryName}`,
        name: directoryName,
        isCollapsed: true,
        isDirectory: true,
        isFile: false,
        isMarkdown: false,
        folders: [],
        files: []
      }
      currentSubFolders.push(childFolder)
    }

    currentPath = `${currentPath}${PATH_SEPARATOR}${directoryName}`
    currentSubFolders = childFolder.folders
  }
}

/**
 * Remove the given file from the tree list.
 *
 * @param {*} tree Root file tree
 * @param {*} file The file that should be deleted
 */
export const unlinkFile = (tree, file) => {
  const { pathname } = file
  const dirname = path.dirname(pathname)
  const subDirectories = getSubdirectoriesFromRoot(tree.pathname, dirname)

  let currentFolder = tree
  let currentSubFolders = tree.folders
  for (const directoryName of subDirectories) {
    const childFolder = currentSubFolders.find(f => f.name === directoryName)
    if (!childFolder) return
    currentFolder = childFolder
    currentSubFolders = childFolder.folders
  }

  const index = currentFolder.files.findIndex(f => f.pathname === pathname)
  if (index !== -1) {
    currentFolder.files.splice(index, 1)
  }
}

/**
 * Update a given file in the tree list.
 *
 * @param {*} tree Root file tree
 * @param {*} file The file that was changed
 */
export const changeFile = (tree, file) => {
  const { pathname, data } = file
  const dirname = path.dirname(pathname)
  const subDirectories = getSubdirectoriesFromRoot(tree.pathname, dirname)

  let currentFolder = tree
  let currentSubFolders = tree.folders
  for (const directoryName of subDirectories) {
    const childFolder = currentSubFolders.find(f => f.name === directoryName)
    if (!childFolder) return
    currentFolder = childFolder
    currentSubFolders = childFolder.folders
  }

  const index = currentFolder.files.findIndex(f => f.pathname === pathname)
  if (index !== -1) {
    currentFolder.files[index].data = data
  }
}

/**
 * Remove the given directory from the tree list.
 *
 * @param {*} tree Root file tree
 * @param {*} dir The directory that should be deleted
 */
export const unlinkDirectory = (tree, dir) => {
  const { pathname } = dir
  const subDirectories = getSubdirectoriesFromRoot(tree.pathname, pathname)

  subDirectories.pop()
  let currentFolder = tree.folders
  for (const directoryName of subDirectories) {
    const childFolder = currentFolder.find(f => f.name === directoryName)
    if (!childFolder) return
    currentFolder = childFolder.folders
  }

  const index = currentFolder.findIndex(f => f.pathname === pathname)
  if (index !== -1) {
    currentFolder.splice(index, 1)
  }
}
