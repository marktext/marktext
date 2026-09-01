import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock isomorphic-git so the network wrappers and their callbacks (onAuth,
// onProgress) can be exercised without a transport. Vitest isolates module
// registries per test file, so github-git.spec.ts still uses the real lib.
// vi.hoisted keeps the mock object available to the hoisted vi.mock factory.
const gitMock = vi.hoisted(() => ({
  clone: vi.fn(),
  fetch: vi.fn(),
  push: vi.fn(),
  merge: vi.fn(),
  checkout: vi.fn(),
  currentBranch: vi.fn(),
  statusMatrix: vi.fn(),
  findMergeBase: vi.fn(),
  resolveRef: vi.fn(),
  log: vi.fn(),
  listRemotes: vi.fn()
}))
vi.mock('isomorphic-git', () => ({ default: gitMock }))
vi.mock('isomorphic-git/http/node', () => ({ default: { name: 'http-node' } }))

import { cloneRepo, fetchRemote, pushBranch, currentBranch, sync } from 'main_renderer/github/git'

beforeEach(() => {
  vi.clearAllMocks()
  gitMock.statusMatrix.mockResolvedValue([]) // clean tree
  gitMock.currentBranch.mockResolvedValue('main')
  gitMock.findMergeBase.mockResolvedValue(['base'])
  gitMock.resolveRef.mockResolvedValue('oid')
  gitMock.log.mockResolvedValue([{ oid: 'a' }, { oid: 'base' }]) // count = 1
  gitMock.merge.mockResolvedValue(undefined)
  gitMock.checkout.mockResolvedValue(undefined)
  gitMock.fetch.mockResolvedValue(undefined)
  gitMock.push.mockResolvedValue(undefined)
  gitMock.clone.mockResolvedValue(undefined)
  gitMock.listRemotes.mockResolvedValue([{ remote: 'origin', url: 'https://github.com/o/r.git' }])
})

describe('github/git network wrappers', () => {
  it('cloneRepo requests a single-branch clone and normalizes progress', async() => {
    const progress: Array<{ total: number }> = []
    gitMock.clone.mockImplementation(async(opts: { onProgress: (e: unknown) => void }) => {
      opts.onProgress({ phase: 'counting', loaded: 5 }) // total undefined → 0
      opts.onProgress({ phase: 'counting', loaded: 5, total: 10 })
    })
    await cloneRepo('https://github.com/o/r.git', '/dst', async() => 'tok', (p) =>
      progress.push(p)
    )
    const opts = gitMock.clone.mock.calls[0][0]
    expect(opts.url).toBe('https://github.com/o/r.git')
    expect(opts.singleBranch).toBe(true)
    expect(progress[0].total).toBe(0)
    expect(progress[1].total).toBe(10)
  })

  it('onAuth supplies the token only for github.com URLs', async() => {
    let creds: unknown
    gitMock.fetch.mockImplementation(async(opts: { onAuth: (url: string) => Promise<unknown> }) => {
      creds = await opts.onAuth('https://github.com/o/r.git')
    })
    await fetchRemote('/repo', async() => 'my-token')
    expect(creds).toEqual({ username: 'my-token', password: 'x-oauth-basic' })
  })

  it('onAuth withholds the token from non-github hosts (exfil guard)', async() => {
    let creds: unknown
    gitMock.push.mockImplementation(async(opts: { onAuth: (url: string) => Promise<unknown> }) => {
      creds = await opts.onAuth('https://attacker.example/x.git')
    })
    await pushBranch('/repo', async() => 'my-token')
    // No credentials handed to a non-github host.
    expect(creds).toEqual({})
  })

  it('onAuth throws when no token is available for a github URL', async() => {
    gitMock.push.mockImplementation(async(opts: { onAuth: (url: string) => Promise<unknown> }) => {
      await opts.onAuth('https://github.com/o/r.git')
    })
    await expect(pushBranch('/repo', async() => null)).rejects.toThrow('Not authenticated')
  })

  it('fetchRemote resolves the origin to an https github url and passes it explicitly', async() => {
    gitMock.listRemotes.mockResolvedValue([
      { remote: 'origin', url: 'git@github.com:o/r.git' }
    ])
    await fetchRemote('/repo', async() => 'tok')
    expect(gitMock.fetch.mock.calls[0][0].url).toBe('https://github.com/o/r.git')
  })

  it('pushBranch refuses a non-github origin', async() => {
    gitMock.listRemotes.mockResolvedValue([
      { remote: 'origin', url: 'https://gitlab.com/o/r.git' }
    ])
    await expect(pushBranch('/repo', async() => 'tok')).rejects.toThrow(/github/i)
  })

  it('currentBranch falls back to main when detached', async() => {
    gitMock.currentBranch.mockResolvedValueOnce(undefined)
    expect(await currentBranch('/repo')).toBe('main')
  })

  it('sync fetches, merges, and pushes on a clean fast-forward', async() => {
    const res = await sync('/repo', async() => 'tok', { name: 'M', email: 'm@e.com' })
    expect(gitMock.fetch).toHaveBeenCalled()
    expect(gitMock.merge).toHaveBeenCalled()
    expect(gitMock.push).toHaveBeenCalled()
    expect(res.conflict).toBe(false)
    // After a clean merge + push, no pending commits remain (H2).
    expect(res.behind).toBe(0)
    expect(res.ahead).toBe(0)
  })

  it('sync re-checks dirtiness after fetch (autosave during the network window)', async() => {
    // Clean before fetch, dirty after (an autosave landed during the fetch).
    gitMock.statusMatrix.mockResolvedValueOnce([]).mockResolvedValueOnce([['a.md', 1, 2, 1]])
    const res = await sync('/repo', async() => 'tok', { name: 'M', email: 'm@e.com' })
    expect(res.dirty).toBe(true)
    expect(gitMock.fetch).toHaveBeenCalled() // fetch ran
    expect(gitMock.merge).not.toHaveBeenCalled() // but we refused to merge onto a now-dirty tree
  })

  it('sync reports zero ahead/behind after a clean push', async() => {
    const res = await sync('/repo', async() => 'tok', { name: 'M', email: 'm@e.com' })
    expect(res.conflict).toBe(false)
    expect(res.ahead).toBe(0)
    expect(res.behind).toBe(0)
    expect(gitMock.push).toHaveBeenCalled()
  })

  it('sync does not push when the merge conflicts', async() => {
    gitMock.merge.mockRejectedValueOnce({ code: 'MergeConflictError', data: { filepaths: ['a.md'] } })
    const res = await sync('/repo', async() => 'tok', { name: 'M', email: 'm@e.com' })
    expect(res.conflict).toBe(true)
    expect(res.files).toEqual(['a.md'])
    expect(gitMock.push).not.toHaveBeenCalled()
  })

  it('sync rethrows a non-merge error from the merge step', async() => {
    gitMock.merge.mockRejectedValueOnce({ code: 'SomethingElse' })
    await expect(sync('/repo', async() => 'tok', { name: 'M', email: 'm@e.com' })).rejects.toEqual({
      code: 'SomethingElse'
    })
  })

  it('countCommits treats an unresolvable ref as zero divergence', async() => {
    gitMock.resolveRef.mockRejectedValue(new Error('no ref'))
    const res = await sync('/repo', async() => 'tok', { name: 'M', email: 'm@e.com' })
    // behind resolves to 0 → no merge. Still pushes any local-ahead commits.
    expect(res.behind).toBe(0)
    expect(res.conflict).toBe(false)
    expect(gitMock.merge).not.toHaveBeenCalled()
    expect(gitMock.push).toHaveBeenCalled()
  })
})
