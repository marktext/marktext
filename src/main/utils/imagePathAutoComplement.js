import fsPromises from 'fs/promises'
import { filter } from 'fuzzaldrin'
import { IMAGE_EXTENSIONS } from 'common/filesystem/paths'

const BLACK_LIST = Object.freeze(['$RECYCLE.BIN'])
const IMAGE_EXTENSION_REGEX = new RegExp('(' + IMAGE_EXTENSIONS.join('|') + ')$', 'i')

const filterListByQuery = (contentList, query) => {
  const filteredEntries = contentList
    .map(entry => {
      const file = entry.name
      if (entry.isDirectory()) {
        return { file, type: 'directory' }
      } else if (entry.isFile() && IMAGE_EXTENSION_REGEX.test(file)) {
        return { file, type: 'image' }
      }
      return null
    })
    .filter(entry => entry && !BLACK_LIST.includes(entry.file))
  return filter(filteredEntries, query, { key: 'file' })
}

/**
 * Returns a list of images and sub-directories of the given directory and filter query.
 *
 * @param {String} directory The directory to search in.
 * @param {String} query The query to filter by.
 * @returns The filtered directory contents.
 */
export const searchFilesAndDir = async (directory, query) => {
  const contentList = await fsPromises.readdir(directory, { withFileTypes: true })
  return filterListByQuery(contentList, query)
}
