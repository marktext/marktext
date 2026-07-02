import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const askForSaveAll = vi.fn()
vi.mock('@/store/editor', () => ({
  useEditorStore: () => ({ ASK_FOR_SAVE_ALL: askForSaveAll })
}))

// Captured event callbacks so the test can simulate main → renderer pushes.
let authSuccessCb: ((s: { signedIn: boolean; username?: string }) => void) | undefined
let statusChangedCb: ((repoPath: string) => void) | undefined

const github = {
  authStatus: vi.fn(async() => ({ signedIn: true, username: 'octocat' })),
  authStart: vi.fn(async() => ({
    userCode: 'WDJB',
    verificationUri: 'https://github.com/login/device',
    expiresIn: 900,
    interval: 5
  })),
  signOut: vi.fn(async() => {}),
  listRepos: vi.fn(async() => [
    { fullName: 'octocat/hello', cloneUrl: 'c', private: false, defaultBranch: 'main' }
  ]),
  clone: vi.fn(async() => ({ localPath: '/tmp/hello' })),
  status: vi.fn(async() => [{ filepath: 'a.md', status: 'modified', staged: true }]),
  stage: vi.fn(async() => [{ filepath: 'a.md', status: 'modified', staged: true }]),
  unstage: vi.fn(async() => [{ filepath: 'a.md', status: 'modified', staged: false }]),
  commit: vi.fn(async() => ({ oid: 'oid' })),
  sync: vi.fn(async() => ({ conflict: false, dirty: false, files: [], ahead: 0, behind: 1 })),
  repoInfo: vi.fn(async() => ({ isRepo: true, remoteUrl: 'u', httpsUrl: 'h' })),
  lfsCheck: vi.fn(async() => false),
  onAuthSuccess: vi.fn((cb) => {
    authSuccessCb = cb
  }),
  onAuthError: vi.fn(),
  onCloneProgress: vi.fn(),
  onStatusChanged: vi.fn((cb) => {
    statusChangedCb = cb
  })
}

const openExternal = vi.fn()

import { useGithubStore } from '@/store/github'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  ;(globalThis as unknown as { window: unknown }).window = globalThis
  ;(globalThis as unknown as { github: unknown }).github = github
  ;(globalThis as unknown as { electron: unknown }).electron = { shell: { openExternal } }
})
afterEach(() => vi.useRealTimers())

describe('github store — auth', () => {
  it('refreshAuth reflects the auth status', async() => {
    const store = useGithubStore()
    await store.refreshAuth()
    expect(store.signedIn).toBe(true)
    expect(store.username).toBe('octocat')
  })

  it('startAuth opens the verification URI and returns the code', async() => {
    const store = useGithubStore()
    const info = await store.startAuth()
    expect(openExternal).toHaveBeenCalledWith('https://github.com/login/device')
    expect(info.userCode).toBe('WDJB')
  })

  it('signOut clears auth state', async() => {
    const store = useGithubStore()
    await store.refreshAuth()
    await store.signOut()
    expect(store.signedIn).toBe(false)
    expect(store.username).toBeUndefined()
  })

  it('an auth-success push flips signedIn and loads repos', async() => {
    const store = useGithubStore()
    authSuccessCb!({ signedIn: true, username: 'octocat' })
    await Promise.resolve()
    await Promise.resolve()
    expect(store.signedIn).toBe(true)
    expect(github.listRepos).toHaveBeenCalled()
  })
})

describe('github store — repo + status', () => {
  it('loadRepos populates the repo list', async() => {
    const store = useGithubStore()
    await store.loadRepos()
    expect(store.repos).toHaveLength(1)
  })

  it('cloneRepo toggles busy and returns the local path', async() => {
    const store = useGithubStore()
    const p = store.cloneRepo('c', '/tmp')
    expect(store.busy).toBe(true)
    expect(await p).toBe('/tmp/hello')
    expect(store.busy).toBe(false)
  })

  it('detectRepoForFolder sets the repo when the folder is a github repo', async() => {
    const store = useGithubStore()
    await store.detectRepoForFolder('/tmp/hello')
    expect(store.repoPath).toBe('/tmp/hello')
    expect(store.changes).toHaveLength(1)
  })

  it('detectRepoForFolder clears the repo when the folder is not a github repo', async() => {
    github.repoInfo.mockResolvedValueOnce({ isRepo: false } as never)
    const store = useGithubStore()
    await store.detectRepoForFolder('/tmp/plain')
    expect(store.repoPath).toBeNull()
    expect(store.changes).toHaveLength(0)
  })

  it('detectRepoForFolder with null clears the repo', async() => {
    const store = useGithubStore()
    await store.detectRepoForFolder(null)
    expect(store.repoPath).toBeNull()
  })

  it('setRepo records an LFS warning', async() => {
    github.lfsCheck.mockResolvedValueOnce(true)
    const store = useGithubStore()
    await store.setRepo('/tmp/hello')
    expect(store.lfsWarning).toBe(true)
  })

  it('stage and unstage update the change list', async() => {
    const store = useGithubStore()
    await store.setRepo('/tmp/hello')
    await store.stage(['a.md'])
    expect(store.changes[0].staged).toBe(true)
    await store.unstage(['a.md'])
    expect(store.changes[0].staged).toBe(false)
  })

  it('stage, unstage, and commit are no-ops without a repo', async() => {
    const store = useGithubStore()
    await store.stage(['a.md'])
    await store.unstage(['a.md'])
    await store.commit('msg')
    expect(github.stage).not.toHaveBeenCalled()
    expect(github.unstage).not.toHaveBeenCalled()
    expect(github.commit).not.toHaveBeenCalled()
  })

  it('commit refreshes status', async() => {
    const store = useGithubStore()
    await store.setRepo('/tmp/hello')
    github.status.mockClear()
    await store.commit('msg')
    expect(github.commit).toHaveBeenCalledWith('/tmp/hello', 'msg')
    expect(github.status).toHaveBeenCalled()
  })
})

describe('github store — sync', () => {
  it('sync saves all tabs, then records ahead/behind', async() => {
    const store = useGithubStore()
    await store.setRepo('/tmp/hello')
    const res = await store.sync()
    expect(askForSaveAll).toHaveBeenCalledWith(false)
    expect(res?.behind).toBe(1)
    expect(store.behind).toBe(1)
    expect(store.conflictFiles).toHaveLength(0)
  })

  it('sync records conflict files', async() => {
    github.sync.mockResolvedValueOnce({
      conflict: true,
      dirty: false,
      files: ['a.md'],
      ahead: 1,
      behind: 1
    } as never)
    const store = useGithubStore()
    await store.setRepo('/tmp/hello')
    const res = await store.sync()
    expect(res?.conflict).toBe(true)
    expect(store.conflictFiles).toEqual(['a.md'])
  })

  it('sync returns null without a repo', async() => {
    const store = useGithubStore()
    expect(await store.sync()).toBeNull()
  })
})

describe('github store — status-changed debounce', () => {
  it('collapses a burst of matching status-changed events into one refresh', async() => {
    vi.useFakeTimers()
    const store = useGithubStore()
    await store.setRepo('/tmp/hello')
    github.status.mockClear()
    statusChangedCb!('/tmp/hello')
    statusChangedCb!('/tmp/hello')
    statusChangedCb!('/tmp/hello')
    await vi.advanceTimersByTimeAsync(300)
    expect(github.status).toHaveBeenCalledTimes(1)
  })

  it('ignores status-changed for a different repo', async() => {
    vi.useFakeTimers()
    const store = useGithubStore()
    await store.setRepo('/tmp/hello')
    github.status.mockClear()
    statusChangedCb!('/tmp/other')
    await vi.advanceTimersByTimeAsync(300)
    expect(github.status).not.toHaveBeenCalled()
  })
})
