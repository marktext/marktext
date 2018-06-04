import path from 'path'
import { getUniqueId } from '../util'

const getPathArr = (projectName, pathname) => {
  let [prePath, partPath] = pathname.split(projectName)
  partPath = partPath.replace(/^\/+(.*)/, (_, p1) => p1)
  prePath += projectName
  const tokens = partPath ? partPath.split('/') : []

  return { prePath, tokens }
}

export const addFile = (tree, file) => {
  const { pathname, name } = file
  const dirname = path.dirname(pathname)
  let { prePath, tokens } = getPathArr(tree.name, dirname)
  let folder = tree
  let folders = tree.folders

  for (const token of tokens) {
    let childFolder = folders.find(f => f.name === token)
    if (!childFolder) {
      childFolder = {
        id: getUniqueId(),
        pathname: `${prePath}/${token}`,
        name: token,
        isCollapsed: true,
        isDirectory: true,
        isFile: false,
        isMarkdown: false,
        folders: [],
        files: []
      }
      folders.push(childFolder)
    }
    prePath = `${prePath}/${token}`
    folder = childFolder
    folders = childFolder.folders
  }

  if (!folder.files.find(f => f.name === name)) {
    file.id = getUniqueId()
    folder.files.push(file)
  }
}

export const addDirectory = (tree, dir) => {
  let { prePath, tokens } = getPathArr(tree.name, dir.pathname)
  let folders = tree.folders

  for (const token of tokens) {
    let childFolder = folders.find(f => f.name === token)
    if (!childFolder) {
      childFolder = {
        id: getUniqueId(),
        pathname: `${prePath}/${token}`,
        name: token,
        isCollapsed: true,
        isDirectory: true,
        isFile: false,
        isMarkdown: false,
        folders: [],
        files: []
      }
      folders.push(childFolder)
    }
    prePath = `${prePath}/${token}`
    folders = childFolder.folders
  }
}

export const unlinkFile = (tree, file) => {
  const { pathname } = file
  const dirname = path.dirname(pathname)
  let { tokens } = getPathArr(tree.name, dirname)

  let folder = tree
  let folders = tree.folders

  for (const token of tokens) {
    const childFolder = folders.find(f => f.name === token)
    if (!childFolder) return
    folder = childFolder
    folders = childFolder.folders
  }

  const index = folder.files.findIndex(f => f.pathname === pathname)

  if (index > -1) {
    folder.files.splice(index, 1)
  }
}

export const changeFile = (tree, file) => {
  const { pathname, data } = file
  const dirname = path.dirname(pathname)
  let { tokens } = getPathArr(tree.name, dirname)

  let folder = tree
  let folders = tree.folders

  for (const token of tokens) {
    const childFolder = folders.find(f => f.name === token)
    if (!childFolder) return
    folder = childFolder
    folders = childFolder.folders
  }

  const index = folder.files.findIndex(f => f.pathname === pathname)
  folder.files[index].data = data
}

export const unlinkDirectory = (tree, dir) => {
  const { pathname } = dir
  const { tokens } = getPathArr(tree.name, pathname)

  tokens.pop()
  let folders = tree.folders

  for (const token of tokens) {
    const childFolder = folders.find(f => f.name === token)
    if (!childFolder) return
    folders = childFolder.folders
  }

  const index = folders.findIndex(f => f.pathname === pathname)

  if (index > -1) {
    folders.splice(index, 1)
  }
}
