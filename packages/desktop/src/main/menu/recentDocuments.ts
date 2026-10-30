import fs from 'fs'
import path from 'path'
import log from 'electron-log'
import { ensureDirSync, isDirectory2, isFile2 } from 'common/filesystem'
import type { RecentDocument } from '@shared/types/ipc'
import { relocateResourcePath, type ResourceMove } from 'common/filesystem/resourceMove'

export type { RecentDocument }

const VOLUME_CONTAINERS = ['/Volumes', '/media', '/run/media', '/mnt']

export const isVolumeRootPath = (pathname: string): boolean => {
  const parent = path.dirname(pathname)
  if (VOLUME_CONTAINERS.includes(parent)) return true
  return VOLUME_CONTAINERS.includes(path.dirname(parent))
}

export class RecentDocumentsStore {
  private readonly storagePath: string

  constructor(storagePath: string) {
    this.storagePath = storagePath
  }

  read(): RecentDocument[] {
    const { documents, keptPaths, changed } = this._prune()

    if (changed) this._writePaths(keptPaths)

    return documents
  }

  add(pathname: string): RecentDocument[] {
    const { documents, keptPaths } = this._prune()

    if (keptPaths[0] !== pathname) {
      const paths = [pathname, ...keptPaths.filter((documentPath) => documentPath !== pathname)]
      this._writePaths(paths)
    }

    if (isFile2(pathname)) {
      return [{ pathname, isDirectory: false }, ...documents.filter((document) => document.pathname !== pathname)]
    }
    if (isDirectory2(pathname)) {
      return [{ pathname, isDirectory: true }, ...documents.filter((document) => document.pathname !== pathname)]
    }
    return documents
  }

  remove(pathname: string): RecentDocument[] {
    const { documents, keptPaths } = this._prune()

    this._writePaths(keptPaths.filter((documentPath) => documentPath !== pathname))
    return documents.filter((document) => document.pathname !== pathname)
  }

  relocate(move: ResourceMove): RecentDocument[] {
    // Read before pruning: a moved directory's old children look like unavailable volumes.
    const paths = this._readPaths().map(pathname => relocateResourcePath(pathname, move) ?? pathname)
    this._writePaths(paths)
    return this.read()
  }

  clear(): void {
    this._writePaths([])
  }

  private _prune(): { documents: RecentDocument[]; keptPaths: string[]; changed: boolean } {
    const paths = this._readPaths()
    const documents: RecentDocument[] = []
    const keptPaths: string[] = []
    const seen = new Set<string>()
    let changed = false

    for (const pathname of paths) {
      if (!pathname || seen.has(pathname)) {
        changed = true
        continue
      }
      seen.add(pathname)

      if (isFile2(pathname)) {
        documents.push({ pathname, isDirectory: false })
        keptPaths.push(pathname)
      } else if (isDirectory2(pathname)) {
        documents.push({ pathname, isDirectory: true })
        keptPaths.push(pathname)
      } else if (!isDirectory2(path.dirname(pathname)) || isVolumeRootPath(pathname)) {
        keptPaths.push(pathname)
      } else {
        changed = true
      }
    }

    return { documents, keptPaths, changed }
  }

  private _readPaths(): string[] {
    if (!isFile2(this.storagePath)) return []

    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(this.storagePath, 'utf-8'))
      return Array.isArray(parsed)
        ? parsed.filter((entry): entry is string => typeof entry === 'string')
        : []
    } catch (err) {
      log.error('Error while reading recently used documents:', err)
      return []
    }
  }

  private _writePaths(paths: string[]): void {
    try {
      ensureDirSync(path.dirname(this.storagePath))
      const tempPath = `${this.storagePath}.tmp`
      fs.writeFileSync(tempPath, JSON.stringify(paths, null, 2), 'utf-8')
      fs.renameSync(tempPath, this.storagePath)
    } catch (err) {
      log.error('Error while saving recently used documents:', err)
    }
  }
}
