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

export interface ProjectRootWatch {
  rootKey: string
  watchToken: string
  onStatus: (status: 'ready' | 'unavailable', error?: string) => void
}
