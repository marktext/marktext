import type { FileChangeDetail } from './files'

export interface ProjectRoot {
  key: string
  pathname: string
  watchToken: string
  status: 'loading' | 'ready' | 'unavailable'
  error?: string
}

export interface ProjectRootsSnapshot {
  revision: number
  roots: ProjectRoot[]
  reason: 'add' | 'remove' | 'replace' | 'restore' | 'status' | 'reveal'
  targetKey?: string
}

export interface ProjectTreeEvent {
  rootKey: string
  watchToken: string
  type: 'add' | 'unlink' | 'addDir' | 'unlinkDir' | 'change'
  change: FileChangeDetail
}

export interface BufferedRoot {
  pathname: string
  collapsedPaths: string[]
}

export interface BufferedProjectState {
  roots: BufferedRoot[]
}

export interface ProjectRootWatch {
  rootKey: string
  watchToken: string
  onStatus: (status: 'ready' | 'unavailable', error?: string) => void
}

export const readBufferedRoots = (state: unknown): BufferedRoot[] => {
  if (!state || typeof state !== 'object') return []
  const value = state as {
    roots?: unknown
    rootDirectory?: unknown
    projectTree?: { pathname?: string }
  }
  if (Array.isArray(value.roots)) {
    return value.roots
      .filter(
        (root): root is BufferedRoot =>
          !!root && typeof root.pathname === 'string' && !!root.pathname
      )
      .map((root) => ({
        pathname: root.pathname,
        collapsedPaths: Array.isArray(root.collapsedPaths)
          ? root.collapsedPaths.filter((p) => typeof p === 'string')
          : []
      }))
  }
  const pathname = value.rootDirectory || value.projectTree?.pathname
  return typeof pathname === 'string' && pathname ? [{ pathname, collapsedPaths: [] }] : []
}
