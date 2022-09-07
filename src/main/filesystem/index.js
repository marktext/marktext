import fs from 'fs-extra'
import path from 'path'
import { Web3Storage, File } from 'web3.storage'
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

  const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkaWQ6ZXRocjoweDU4ZDc1ZjYzN2Y5NDc2YzVkQmU1OGIxNzEyN0Q1MGU0NDgxMzUzQjQiLCJpc3MiOiJ3ZWIzLXN0b3JhZ2UiLCJpYXQiOjE2NjE0MDU2Mzc2MDQsIm5hbWUiOiJ4aW5taW5zdSJ9.sb1ATMTwOtsquSn6kTWQylCRUZjVDWrGUq5o6sLHlis";
	const storage = new Web3Storage({ token });

  const files = await getFilesFromPath(pathname);
	const cid = await storage.put(files);
	console.log('Content added with CID:', cid);

  return fs.outputFile(pathname, content, options)
}
