import path from 'node:path'
import type { FileLocation } from '@shared/types/applicationState'
import { containsPath } from './paths'

/** Captured before disk mutation so both the requested alias and real source remain identifiable. */
export interface ResourceMove {
  source: FileLocation
  destination: FileLocation
}

/** All consumers use the captured destination; unrelated paths return null. */
export const relocateResourcePath = (pathname: string, move: ResourceMove): string | null => {
  for (const source of [move.source.path, move.source.canonicalPath]) {
    if (containsPath(source, pathname)) {
      return path.join(move.destination.path, path.relative(source, pathname))
    }
  }
  return null
}
