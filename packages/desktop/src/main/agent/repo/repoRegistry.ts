import path from 'path'
import type { RepoState } from '@shared/types/agent'

export type RepoBinding =
  | { kind: 'none' }
  | { kind: 'repo'; root: string; userName: string }

export type RepoClaim =
  | { ok: true }
  | { ok: false; ownerWindowId: number }

/**
 * One editor window per repository root. A folder that is not a repository
 * does not occupy an entry, so several such windows can be open together.
 */
export class RepoRegistry {
  private readonly byRoot = new Map<string, { windowId: number; root: string; userName: string }>()
  private readonly byWindow = new Map<number, RepoBinding>()

  state(windowId: number): RepoState {
    const binding = this.byWindow.get(windowId)
    if (!binding || binding.kind === 'none') return { kind: 'none' }
    return { kind: 'repo', root: binding.root, userName: binding.userName }
  }

  /** Window that already has this root open, or null. */
  owner(root: string): number | null {
    return this.byRoot.get(rootKey(root))?.windowId ?? null
  }

  /**
   * Bind the window to `binding`. A root already held by another window is left
   * unchanged and reported through `ownerWindowId`.
   */
  claim(windowId: number, binding: RepoBinding): RepoClaim {
    if (binding.kind === 'repo') {
      const existing = this.byRoot.get(rootKey(binding.root))
      if (existing && existing.windowId !== windowId) {
        return { ok: false, ownerWindowId: existing.windowId }
      }
    }

    this.release(windowId)
    if (binding.kind === 'none') {
      this.byWindow.set(windowId, { kind: 'none' })
      return { ok: true }
    }

    const root = canonicalRoot(binding.root)
    this.byRoot.set(rootKey(root), { windowId, root, userName: binding.userName })
    this.byWindow.set(windowId, { kind: 'repo', root, userName: binding.userName })
    return { ok: true }
  }

  release(windowId: number): void {
    const current = this.byWindow.get(windowId)
    if (current?.kind === 'repo') {
      const key = rootKey(current.root)
      if (this.byRoot.get(key)?.windowId === windowId) this.byRoot.delete(key)
    }
    this.byWindow.delete(windowId)
  }
}

export const repoRegistry = new RepoRegistry()

const canonicalRoot = (root: string): string =>
  process.platform === 'win32' ? path.win32.normalize(root) : path.resolve(root)

const rootKey = (root: string): string => {
  const canonical = canonicalRoot(root)
  // Git on Windows reports either slash style, and the volume letter's case is not significant.
  return process.platform === 'win32' ? canonical.toLowerCase() : canonical
}
