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
  log: vi.fn()
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

  it('onAuth supplies the token as the username', async() => {
    let creds: unknown
    gitMock.fetch.mockImplementation(async(opts: { onAuth: () => Promise<unknown> }) => {
      creds = await opts.onAuth()
    })
    await fetchRemote('/repo', async() => 'my-token')
    expect(creds).toEqual({ username: 'my-token', password: 'x-oauth-basic' })
  })

  it('onAuth throws when no token is available', async() => {
    gitMock.push.mockImplementation(async(opts: { onAuth: () => Promise<unknown> }) => {
      await opts.onAuth()
    })
    await expect(pushBranch('/repo', async() => null)).rejects.toThrow('Not authenticated')
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
    expect(res.behind).toBe(1)
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
