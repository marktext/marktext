import path from 'path'
import fsPromises from 'fs/promises'
import { hasMarkdownExtension } from 'common/filesystem/paths'

const readlink = async (parentDirectory, fullPath) => {
  const relativePathToTarget = await fsPromises.readlink(fullPath)
  return path.resolve(parentDirectory, relativePathToTarget)
}

export const readDirectoryContentsForSideBar = async fullPath => {
  const dirContents = await fsPromises.readdir(fullPath, { withFileTypes: true })
  const contentList = []
  for (const entry of dirContents) {
    const pathname = path.join(fullPath, entry.name)
    if (entry.isSymbolicLink()) {
      try {
        const realPath = await readlink(fullPath, pathname)
        const fileInfo = await fsPromises.stat(realPath)

        // Return symlink path with original file information. Otherwise
        // the entry would be resolved to the link target.
        filterEntry(contentList, fileInfo, pathname)
      } catch (error) {
        console.error('Unable to resolve symlink:', error)
      }
    } else {
      filterEntry(contentList, entry, pathname)
    }
  }
  return contentList
}

const filterEntry = (contentList, fileInfo, fullPath) => {
  if (fileInfo.isDirectory()) {
    contentList.push(convertToDirectoryEntry(fullPath))
  } else if (fileInfo.isFile() && hasMarkdownExtension(fullPath)) {
    contentList.push(convertToFileEntry(fullPath))
  }
}

const convertToDirectoryEntry = fullPath => {
  return {
    path: fullPath,
    isDirectory: true
  }
}

const convertToFileEntry = fullPath => {
  return {
    path: fullPath,
    isDirectory: false
  }
}
