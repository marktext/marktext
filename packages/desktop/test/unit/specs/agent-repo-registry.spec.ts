import { execFile } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { getRepoRoot } from 'main_renderer/agent/repo/gitService'
import { RepoRegistry } from 'main_renderer/agent/repo/repoRegistry'
import { resolveFolderRepo } from 'main_renderer/agent/repo/resolveFolderRepo'
import {
  clearWindowAgentHost,
  setWindowAgentHost,
  shutdownWindowAgent
} from 'main_renderer/agent/windowAgentHost'

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

const tempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-repo-'))
  dirs.push(dir)
  return dir
}

const git = (cwd: string, args: string[]): Promise<void> =>
  new Promise((resolve, reject) => {
    execFile('git', args, { cwd }, (error) => {
      if (error) reject(error)
      else resolve()
    })
  })

describe('repoRegistry', () => {
  it('does not give two windows one repository root', async() => {
    const dir = tempDir()
    await git(dir, ['init', '-q'])
    fs.mkdirSync(path.join(dir, 'a', 'nested'), { recursive: true })
    fs.mkdirSync(path.join(dir, 'b'))
    const fromA = await getRepoRoot(path.join(dir, 'a', 'nested'))
    const fromB = await getRepoRoot(path.join(dir, 'b'))
    if (fromA == null || fromB == null) {
      throw new Error('expected a repository root')
    }
    expect(fromA).toBe(fromB)

    const registry = new RepoRegistry()
    expect(registry.claim(1, { kind: 'repo', root: fromA, userName: 'Ada' })).toEqual({ ok: true })
    expect(registry.claim(2, { kind: 'repo', root: fromB, userName: 'Ada' })).toEqual({
      ok: false,
      ownerWindowId: 1
    })
    expect(registry.owner(fromB)).toBe(1)
    expect(registry.state(1)).toEqual({ kind: 'repo', root: fromA, userName: 'Ada' })
    expect(registry.state(2)).toEqual({ kind: 'none' })
    registry.adopt(2, { kind: 'repo', root: fromB, userName: 'Ada' })
    expect(registry.owner(fromB)).toBe(1)
    expect(registry.state(2)).toEqual({ kind: 'repo', root: fromA, userName: 'Ada' })
  })

  it('treats a folder outside a work tree as none and lets another window do the same', async() => {
    const dir = tempDir()
    const binding = await resolveFolderRepo(dir)
    expect(binding).toEqual({ kind: 'none' })

    const registry = new RepoRegistry()
    expect(registry.claim(1, binding)).toEqual({ ok: true })
    expect(registry.claim(2, binding)).toEqual({ ok: true })
    expect(registry.state(1)).toEqual({ kind: 'none' })
    expect(registry.state(2)).toEqual({ kind: 'none' })
  })

  it('frees the root when the window releases it or moves to another repository', () => {
    const registry = new RepoRegistry()
    const first = path.resolve('/tmp/repo-a')
    const second = path.resolve('/tmp/repo-b')
    registry.claim(1, { kind: 'repo', root: `${first}/.`, userName: 'Ada' })
    expect(registry.state(1)).toEqual({ kind: 'repo', root: first, userName: 'Ada' })

    registry.claim(1, { kind: 'repo', root: second, userName: 'Ada' })
    expect(registry.owner(first)).toBeNull()
    expect(registry.claim(2, { kind: 'repo', root: first, userName: 'Bea' })).toEqual({ ok: true })

    registry.release(2)
    expect(registry.owner(first)).toBeNull()
    expect(registry.state(2)).toEqual({ kind: 'none' })
  })

  it('lets the owning window claim its root again', () => {
    const registry = new RepoRegistry()
    const root = path.resolve('/tmp/repo-a')
    registry.claim(1, { kind: 'repo', root, userName: 'Ada' })
    expect(registry.claim(1, { kind: 'repo', root, userName: 'Bea' })).toEqual({ ok: true })
    expect(registry.state(1)).toEqual({ kind: 'repo', root, userName: 'Bea' })
  })
})

describe('shutdownWindowAgent', () => {
  afterEach(() => {
    clearWindowAgentHost(7)
  })

  it('cancels the turn before stopping the harness and the terminals', async() => {
    const order: string[] = []
    setWindowAgentHost(7, {
      hasActiveTurn: () => true,
      cancelTurn: async() => {
        order.push('cancel')
      },
      disposeHarness: async() => {
        order.push('harness')
      },
      disposePty: async() => {
        order.push('pty')
      }
    })
    await shutdownWindowAgent(7)
    expect(order).toEqual(['cancel', 'harness', 'pty'])
  })

  it('still stops the harness and the terminals when cancel fails', async() => {
    const order: string[] = []
    setWindowAgentHost(7, {
      hasActiveTurn: () => true,
      cancelTurn: async() => {
        order.push('cancel')
        throw new Error('cancel failed')
      },
      disposeHarness: async() => {
        order.push('harness')
      },
      disposePty: async() => {
        order.push('pty')
      }
    })
    await expect(shutdownWindowAgent(7)).rejects.toThrow('cancel failed')
    expect(order).toEqual(['cancel', 'harness', 'pty'])
  })
})
