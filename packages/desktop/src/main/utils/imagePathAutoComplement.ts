import fs from 'fs'
import path from 'path'
import { filter } from 'fuzzaldrin'
import log from 'electron-log'
import { isDirectory, isFile } from 'common/filesystem'
import { IMAGE_EXTENSIONS } from 'common/filesystem/paths'
import { BLACK_LIST } from '../config'

// TODO(need::refactor): Refactor this file. Just return an array of directories and files without caching and watching?

interface DirOrImageEntry {
  file: string
  type: string
}

// TODO: rebuild cache @jocs
const IMAGE_PATH: Map<string, DirOrImageEntry[]> = new Map()
export const watchers: Map<string, fs.FSWatcher> = new Map()

const IMAGE_REG = new RegExp('(' + IMAGE_EXTENSIONS.join('|') + ')$', 'i')

const filesHandler = (
  files: string[],
  directory: string,
  key?: string
): DirOrImageEntry[] | undefined => {
  const onlyDirAndImage: DirOrImageEntry[] = files
    .map((file): DirOrImageEntry => {
      const fullPath = path.join(directory, file)
      let type = ''
      if (isDirectory(fullPath)) {
        type = 'directory'
      } else if (isFile(fullPath) && IMAGE_REG.test(file)) {
        type = 'image'
      }
      return {
        file,
        type
      }
    })
    .filter(({ file, type }) => {
      if ((BLACK_LIST as readonly string[]).includes(file)) return false
      return type === 'directory' || type === 'image'
    })

  IMAGE_PATH.set(directory, onlyDirAndImage)
  if (key !== undefined) {
    return filter(onlyDirAndImage, key, {
      key: 'file'
    })
  }
  return undefined
}

const rebuild = (directory: string): void => {
  fs.readdir(directory, (err, files) => {
    if (err) {
      log.error('imagePathAutoComplement::rebuild:', err)
    } else {
      filesHandler(files, directory)
    }
  })
}

const watchDirectory = (directory: string): void => {
  if (watchers.has(directory)) return // Do not duplicate watch the same directory
  try {
    const watcher = fs.watch(directory, (eventType, _filename) => {
      if (eventType === 'rename') {
        rebuild(directory)
      }
    })
    // Some directories become unwatchable after construction (network mounts
    // dropping, permission changes); swallow the error and stop watching
    // rather than leaking an uncaught exception into the main process.
    watcher.on('error', (err) => {
      log.error('imagePathAutoComplement::watchDirectory:', err)
      watcher.close()
      watchers.delete(directory)
    })
    watchers.set(directory, watcher)
  } catch (err) {
    // `fs.watch` throws synchronously for directories the OS can't watch —
    // e.g. UNC / \\wsl.localhost network paths on Windows (EISDIR). Image-path
    // auto-complete must degrade to "not watching" instead of crashing the
    // main process with an "Unexpected error" dialog (#3779).
    log.error('imagePathAutoComplement::watchDirectory:', err)
  }
}

export const searchFilesAndDir = (directory: string, key: string): Promise<DirOrImageEntry[]> => {
  let result: DirOrImageEntry[] = []
  if (IMAGE_PATH.has(directory)) {
    result = filter(IMAGE_PATH.get(directory), key, { key: 'file' })
    return Promise.resolve(result)
  } else {
    return new Promise((resolve, reject) => {
      fs.readdir(directory, (err, files) => {
        if (err) {
          reject(err)
        } else {
          result = filesHandler(files, directory, key) ?? []
          watchDirectory(directory)
          resolve(result)
        }
      })
    })
  }
}
