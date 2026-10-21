import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import type { BufferedRoot, ProjectRoot, ProjectRootsSnapshot } from '@shared/types/project'

interface RootEffects {
  publish: (snapshot: ProjectRootsSnapshot) => void
  watch: (root: ProjectRoot) => void
  unwatch: (root: ProjectRoot) => void
  remember: (pathname: string) => void
}

export const resolveExistingPath = (pathname: string): string => {
  try {
    return fs.realpathSync(pathname)
  } catch {
    return path.resolve(pathname)
  }
}

export const containsPath = (parent: string, child: string): boolean => {
  const relative = path.relative(parent, child)
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  )
}

const resolveUnavailableRoot = (pathname: string): string => {
  const parts: string[] = []
  let current = path.resolve(pathname)
  while (true) {
    try {
      return path.join(fs.realpathSync(current), ...parts)
    } catch {
      const parent = path.dirname(current)
      if (parent === current) return path.resolve(pathname)
      parts.unshift(path.basename(current))
      current = parent
    }
  }
}

const resolveRoot = (pathname: string): string => {
  const resolved = fs.realpathSync(pathname)
  if (!fs.statSync(resolved).isDirectory()) throw new Error('Not a directory')
  fs.accessSync(resolved, fs.constants.R_OK | fs.constants.X_OK)
  fs.readdirSync(resolved)
  return resolved
}

export class ProjectRoots {
  roots: ProjectRoot[] = []
  private revision = 0
  private restoredTokens = new Set<string>()

  constructor(private effects: RootEffects) {}

  private publish(reason: ProjectRootsSnapshot['reason'], targetKey?: string): void {
    this.effects.publish({
      revision: ++this.revision,
      roots: this.roots.map((root) => ({ ...root })),
      reason,
      targetKey
    })
  }

  private watch(root: ProjectRoot): void {
    try {
      this.effects.watch(root)
    } catch (error) {
      this.setStatus(root.key, root.watchToken, 'unavailable', String(error))
    }
  }

  add(pathname: string, replace = false): void {
    const resolved = resolveRoot(pathname)
    const duplicate = this.roots.find((root) => path.relative(root.key, resolved) === '')
    if (duplicate && !replace) {
      this.publish('reveal', duplicate.key)
      return
    }
    if (
      !replace &&
      this.roots.some(
        (root) => containsPath(root.key, resolved) || containsPath(resolved, root.key)
      )
    ) {
      throw new Error('overlap')
    }
    const root: ProjectRoot = {
      key: resolved,
      pathname: path.resolve(pathname),
      watchToken: randomUUID(),
      status: 'loading'
    }
    if (replace) this.clear()
    this.roots.push(root)
    this.effects.remember(root.pathname)
    this.publish(replace ? 'replace' : 'add', root.key)
    this.watch(root)
  }

  remove(key: string): boolean {
    const root = this.roots.find((root) => root.key === key)
    if (!root) return false
    this.roots = this.roots.filter((entry) => entry.key !== key)
    this.effects.unwatch(root)
    this.publish('remove', key)
    return true
  }

  retry(key: string): boolean {
    const root = this.roots.find((root) => root.key === key)
    if (!root) return false
    this.effects.unwatch(root)
    root.watchToken = randomUUID()
    try {
      const resolved = resolveRoot(root.pathname)
      if (path.relative(root.key, resolved) !== '') throw new Error('Folder location changed')
      root.status = 'loading'
      delete root.error
      this.publish('status', key)
      this.watch(root)
    } catch (error) {
      this.setStatus(key, root.watchToken, 'unavailable', String(error))
    }
    return true
  }

  setStatus(key: string, token: string, status: ProjectRoot['status'], error?: string): void {
    const root = this.roots.find((root) => root.key === key && root.watchToken === token)
    if (!root) return
    root.status = status
    root.error = error
    this.publish('status', key)
  }

  restore(entries: BufferedRoot[]): void {
    this.clear()
    for (const entry of entries) {
      const pathname = path.resolve(entry.pathname)
      let key = resolveUnavailableRoot(pathname)
      let error: string | undefined
      try {
        key = resolveRoot(pathname)
      } catch (err) {
        error = String(err)
      }
      if (this.roots.some((root) => containsPath(root.key, key) || containsPath(key, root.key)))
        continue
      this.roots.push({
        key,
        pathname,
        watchToken: randomUUID(),
        status: error ? 'unavailable' : 'loading',
        error
      })
    }
    this.restoredTokens = new Set(
      this.roots.filter((root) => root.status === 'loading').map((root) => root.watchToken)
    )
    this.publish('restore')
  }

  startRestored(): void {
    for (const root of this.roots) {
      if (this.restoredTokens.delete(root.watchToken)) this.watch(root)
    }
  }

  clear(): void {
    for (const root of this.roots) this.effects.unwatch(root)
    this.roots = []
    this.restoredTokens.clear()
  }
}
