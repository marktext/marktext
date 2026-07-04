import { readlinkSync, outputFile, remove, rename, type WriteFileOptions } from 'fs-extra'
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

export const writeFile = async(
  pathname: string,
  content: string | Buffer,
  extension?: string,
  options: WriteFileOptions | undefined = 'utf-8'
): Promise<void> => {
  if (!pathname) {
    return Promise.reject(new Error('[ERROR] Cannot save file without path.'))
  }
  pathname = !extension || pathname.endsWith(extension) ? pathname : `${pathname}${extension}`

  // Write to a temp file in the SAME directory, then atomically rename it over
  // the target. A crash/power-loss mid-write can only corrupt the throwaway
  // temp file, never truncate the user's existing document (#3786, #3828) —
  // the rename is atomic on a single volume, which same-directory guarantees.
  // `outputFile` still creates any missing parent directories first, so a save
  // whose folder was moved/deleted recreates it and succeeds (#3509).
  const tempPath = path.join(
    path.dirname(pathname),
    `.${path.basename(pathname)}.${process.pid}.${Date.now()}.tmp`
  )
  try {
    await outputFile(tempPath, content, options)
    await rename(tempPath, pathname)
  } catch (err) {
    await remove(tempPath).catch(() => {})
    throw err
  }
}
