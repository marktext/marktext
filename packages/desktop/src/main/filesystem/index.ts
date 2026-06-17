import { readlinkSync, outputFile, type WriteFileOptions } from 'fs-extra'
import path from 'path'
import { isDirectory, isFile, isSymbolicLink } from 'common/filesystem'

/**
 * Normalize the path into an absolute path and resolves the link target if needed.
 *
 * Returns the absolute path and resolved link, or an empty string if the link
 * target cannot be resolved.
 */
export const normalizeAndResolvePath = (pathname: string): string => {
  if (isSymbolicLink(pathname)) {
    const absPath = path.dirname(pathname)
    const targetPath = path.resolve(absPath, readlinkSync(pathname))
    if (isFile(targetPath) || isDirectory(targetPath)) {
      return path.resolve(targetPath)
    }
    console.error(`Cannot resolve link target "${pathname}" (${targetPath}).`)
    return ''
  }
  return path.resolve(pathname)
}

export const writeFile = (
  pathname: string,
  content: string | Buffer,
  extension?: string,
  options: WriteFileOptions | undefined = 'utf-8'
): Promise<void> => {
  if (!pathname) {
    return Promise.reject(new Error('[ERROR] Cannot save file without path.'))
  }
  pathname = !extension || pathname.endsWith(extension) ? pathname : `${pathname}${extension}`

  return outputFile(pathname, content, options)
}
