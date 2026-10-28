import { randomUUID } from 'node:crypto'
import { contentSha256 } from 'common/filesystem'
export { contentSha256 } from 'common/filesystem'
import { realpathSync } from 'node:fs'
import path from 'node:path'
import type { FileLocation, WorkspaceDescriptor } from '@shared/types/applicationState'

export const createStateId = (): string => randomUUID()

const resolveCanonicalPath = (pathname: string): string => {
  const suffix: string[] = []
  let current = pathname
  while (true) {
    try {
      return path.join(realpathSync(current), ...suffix)
    } catch {
      const parent = path.dirname(current)
      if (parent === current) return pathname
      suffix.unshift(path.basename(current))
      current = parent
    }
  }
}

export const createFileLocation = (pathname: string): FileLocation => {
  if (pathname.length === 0) throw new Error('Resource path must not be empty')
  const absolute = path.resolve(pathname)
  const canonicalPath = resolveCanonicalPath(absolute)
  return { path: absolute, canonicalPath, key: contentSha256(canonicalPath) }
}

export const createWorkspaceDescriptor = (pathnames: string[]): WorkspaceDescriptor | null => {
  const seen = new Set<string>()
  const roots: WorkspaceDescriptor['roots'] = []
  for (const pathname of pathnames) {
    const location = createFileLocation(pathname)
    if (!seen.has(location.key)) {
      seen.add(location.key)
      roots.push({ id: location.key, location })
    }
  }
  if (roots.length === 0) return null
  const identity = roots.map((root) => root.id).sort()
  return { id: contentSha256(JSON.stringify(identity)), roots }
}
