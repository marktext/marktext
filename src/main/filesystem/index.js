import fs from 'fs-extra'
import path from 'path'
import * as IPFS from 'ipfs-core'
import { isDirectory, isFile, isSymbolicLink } from 'common/filesystem'

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

export const writeFile = (pathname, content, extension, options = 'utf-8') => {
  if (!pathname) {
    return Promise.reject(new Error('[ERROR] Cannot save file without path.'))
  }
  pathname = !extension || pathname.endsWith(extension) ? pathname : `${pathname}${extension}`

  return fs.outputFile(pathname, content, options)
}

export const writeFileToIpfs = (pathname, content, extension, options = 'utf-8') => {
  if (!pathname) {
    return Promise.reject(new Error('[ERROR] Cannot save file without path.'))
  }
  pathname = !extension || pathname.endsWith(extension) ? pathname : `${pathname}${extension}`

  try {
    const node = await IPFS.create()
    const version = await node.version()
  
    console.log('Version:', version.version)
    const file = await node.add({
      path: pathname,
      content: content
    });
  
    console.log('Added file:', file.path, file.cid.toString());

  } catch (err) {
    console.error(err)
  }

  return fs.outputFile(pathname, content, options)
}
