import { readlinkSync, ensureDir } from 'fs-extra'
import path from 'path'
import writeFileAtomic from 'write-file-atomic'
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
  options: BufferEncoding | undefined = 'utf-8'
): Promise<void> => {
  if (!pathname) {
    return Promise.reject(new Error('[ERROR] Cannot save file without path.'))
  }
  pathname = !extension || pathname.endsWith(extension) ? pathname : `${pathname}${extension}`

  // write-file-atomic does not create parent directories; recreate a moved or
  // deleted folder first so an (auto)save into it still succeeds (#3509).
  await ensureDir(path.dirname(pathname))

  // Durable atomic save: write to a temp file in the target's directory, fsync
  // it, then rename it over the target. This survives an application crash AND
  // a power loss / OS reboot — the fsync before the rename is what closes the
  // power-loss window that otherwise leaves a full-length, zero-filled file
  // (#3786, #3828); a bare rename is only namespace-atomic, not data-durable.
  // write-file-atomic also preserves the target's mode/owner, writes through a
  // symlink to its target, and uses a unique temp name — all of which a plain
  // temp+rename dropped.
  await writeFileAtomic(pathname, content, options)
}
