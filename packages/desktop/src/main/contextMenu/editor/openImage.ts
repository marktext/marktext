import { fileURLToPath } from 'url'
import { shell } from 'electron'
import log from 'electron-log'
import { isImageFile } from 'common/filesystem/paths'

/**
 * Resolve the `srcURL` Electron reports for a right-clicked image to a path the
 * OS can open, or null when there is nothing to open.
 *
 * Remote (`http:`) and `data:` images have no filesystem path. The extension
 * whitelist in `isImageFile` is what keeps a crafted document from turning
 * "Open Image" into `shell.openPath` on a co-located script or executable, the
 * hole #3575 closed for markdown links.
 */
export const localImagePathFromSrc = (srcURL: string): string | null => {
  if (!srcURL || !/^file:/i.test(srcURL)) return null

  let pathname: string
  try {
    pathname = fileURLToPath(srcURL)
  } catch {
    return null
  }

  return isImageFile(pathname) ? pathname : null
}

/**
 * Hand a local image to the application the OS associates with its format.
 * `shell.openPath` resolves with an error string rather than rejecting when no
 * application is registered, so both outcomes are reported through the log.
 */
export const openImageExternally = async(pathname: string): Promise<void> => {
  try {
    const error = await shell.openPath(pathname)
    if (error) log.error('Opening the image failed:', error)
  } catch (err) {
    log.error('Opening the image failed:', err)
  }
}
