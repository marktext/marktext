import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- electron mock: capture invoke handlers + fake windows ------------------
const handlers = new Map<string, (...a: unknown[]) => unknown>()
const sentEvents: Array<{ channel: string; args: unknown[] }> = []
const emitted: Array<{ event: string; args: unknown[] }> = []
let windowDestroyed = false
const fakeWebContents = {
  send: (channel: string, ...args: unknown[]) => {
    // Mirrors Electron: touching webContents of a destroyed window throws.
    if (windowDestroyed) throw new Error('Object has been destroyed')
    sentEvents.push({ channel, args })
  }
}
const fakeWindow = { id: 7, isDestroyed: () => windowDestroyed, webContents: fakeWebContents }
const showOpenDialog = vi.fn(async() => ({ canceled: false, filePaths: ['/chosen'] }))
// Configurable so a test can simulate "no owning window".
let currentWindow: typeof fakeWindow | null = fakeWindow

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...a: unknown[]) => unknown) => handlers.set(channel, fn),
    emit: (event: string, ...args: unknown[]) => emitted.push({ event, args })
  },
  BrowserWindow: {
    fromWebContents: () => currentWindow,
    getAllWindows: () => [fakeWindow, fakeWindow]
  },
  dialog: { showOpenDialog: (...a: unknown[]) => showOpenDialog(...(a as [])) }
}))
vi.mock('electron-log', () => ({ default: { error: vi.fn() } }))

// --- sibling module mocks ---------------------------------------------------
vi.mock('main_renderer/github/git', () => ({
  // Run the operation immediately so handler logic executes under test.
  withRepoQueue: (_p: string, op: () => Promise<unknown>) => op(),
  listChanges: vi.fn(async() => [{ filepath: 'a.md', status: 'modified', staged: false }]),
  stage: vi.fn(async() => {}),
  unstage: vi.fn(async() => {}),
  commit: vi.fn(async() => 'oid-123'),
  sync: vi.fn(async() => ({ conflict: false, dirty: false, files: [], ahead: 0, behind: 1 })),
  cloneRepo: vi.fn(async(_url, _dir, _tok, onProgress) => {
    onProgress?.({ phase: 'x', loaded: 1, total: 2 })
    onProgress?.({ phase: 'x', loaded: 2, total: 2 })
  }),
  detectRepo: vi.fn(async() => ({ isRepo: true, remoteUrl: 'u', httpsUrl: 'h' })),
  hasLfsPatterns: vi.fn(async() => true),
  toGithubHttpsUrl: (url: string) => {
    const m = url.match(
      /^(?:https:\/\/github\.com\/|(?:ssh:\/\/)?git@github\.com[:/])([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/
    )
    return m ? `https://github.com/${m[1]}.git` : null
  }
}))

let token: string | null = 'tok'
const identity = { login: 'octocat', name: 'The Octocat', id: 42 }
vi.mock('main_renderer/github/auth', () => ({
  getToken: vi.fn(async() => token),
  loadIdentity: vi.fn(async() => identity),
  saveIdentity: vi.fn(async() => {}),
  signOut: vi.fn(async() => {}),
  requestDeviceCode: vi.fn(async() => ({
    deviceCode: 'dc',
    userCode: 'WDJB',
    verificationUri: 'https://github.com/login/device',
    expiresIn: 900,
    interval: 5
  })),
  pollForToken: vi.fn()
}))

vi.mock('main_renderer/github/api', () => ({
  getUser: vi.fn(async() => identity),
  listRepos: vi.fn(async() => [
    { fullName: 'octocat/hello', cloneUrl: 'c', private: false, defaultBranch: 'main' }
  ]),
  commitAuthorFor: (u: { name: string | null; login: string; id: number }) => ({
    name: u.name || u.login,
    email: `${u.id}+${u.login}@users.noreply.github.com`
  })
}))

import { registerGitHubHandlers } from 'main_renderer/github/ipc'
import * as auth from 'main_renderer/github/auth'
import * as api from 'main_renderer/github/api'

const fakeEvent = { sender: {} } as never
const call = (channel: string, ...args: unknown[]) => handlers.get(channel)!(fakeEvent, ...args)

beforeEach(() => {
  handlers.clear()
  sentEvents.length = 0
  emitted.length = 0
  token = 'tok'
  currentWindow = fakeWindow
  windowDestroyed = false
  vi.clearAllMocks()
  showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/chosen'] })
  registerGitHubHandlers()
})

describe('github/ipc handlers', () => {
  it('registers every mt::github invoke channel', () => {
    for (const c of [
      'mt::github::auth-status',
      'mt::github::auth-start',
      'mt::github::sign-out',
      'mt::github::list-repos',
      'mt::github::choose-dir',
      'mt::github::clone',
      'mt::github::status',
      'mt::github::stage',
      'mt::github::unstage',
      'mt::github::commit',
      'mt::github::sync',
      'mt::github::repo-info',
      'mt::github::lfs-check'
    ]) {
      expect(handlers.has(c)).toBe(true)
    }
  })

  it('auth-status reports signed out when no token', async() => {
    token = null
    expect(await call('mt::github::auth-status')).toEqual({ signedIn: false })
  })

  it('auth-status reports the persisted username without a network call', async() => {
    expect(await call('mt::github::auth-status')).toEqual({ signedIn: true, username: 'octocat' })
  })

  it('list-repos throws without a token', async() => {
    token = null
    await expect(call('mt::github::list-repos')).rejects.toThrow('Not authenticated')
  })

  it('list-repos returns the repo list when authenticated', async() => {
    const repos = (await call('mt::github::list-repos')) as unknown[]
    expect(repos).toHaveLength(1)
  })

  it('commit uses the persisted identity as the author and broadcasts', async() => {
    const git = await import('main_renderer/github/git')
    const res = await call('mt::github::commit', '/repo', 'msg')
    expect(res).toEqual({ oid: 'oid-123' })
    expect(git.commit).toHaveBeenCalledWith('/repo', 'msg', {
      name: 'The Octocat',
      email: '42+octocat@users.noreply.github.com'
    })
    // status-changed broadcast to all windows.
    expect(sentEvents.filter((e) => e.channel === 'mt::github::status-changed')).toHaveLength(2)
  })

  it('commit falls back to fetching the identity when none is persisted', async() => {
    const git = await import('main_renderer/github/git')
    await call('mt::github::sign-out') // clear the module-level cached author
    ;(auth.loadIdentity as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    await call('mt::github::commit', '/repo', 'msg')
    // No cached/persisted identity → fetch user + persist it, then use it.
    expect(auth.getToken).toHaveBeenCalled()
    expect(auth.saveIdentity).toHaveBeenCalled()
    expect(git.commit).toHaveBeenCalledWith('/repo', 'msg', {
      name: 'The Octocat',
      email: '42+octocat@users.noreply.github.com'
    })
  })

  it('commit throws when no identity and no token are available', async() => {
    await call('mt::github::sign-out') // clear the module-level cached author
    // -Once so this override cannot leak into later tests (beforeEach only
    // clears call history, not implementations).
    ;(auth.loadIdentity as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    token = null
    await expect(call('mt::github::commit', '/repo', 'msg')).rejects.toThrow('Not authenticated')
  })

  it('sync returns the git result and broadcasts status-changed', async() => {
    const res = (await call('mt::github::sync', '/repo')) as { behind: number }
    expect(res.behind).toBe(1)
    expect(sentEvents.some((e) => e.channel === 'mt::github::status-changed')).toBe(true)
  })

  it('status returns changes without broadcasting', async() => {
    const res = (await call('mt::github::status', '/repo')) as unknown[]
    expect(res).toHaveLength(1)
    expect(sentEvents).toHaveLength(0)
  })

  it('stage and unstage broadcast and return updated status', async() => {
    await call('mt::github::stage', '/repo', ['a.md'])
    await call('mt::github::unstage', '/repo', ['a.md'])
    expect(sentEvents.filter((e) => e.channel === 'mt::github::status-changed')).toHaveLength(4)
  })

  it('clone derives the local path, throttles progress, and opens the folder', async() => {
    const res = (await call('mt::github::clone', 'https://github.com/octocat/hello.git', '/tmp')) as {
      localPath: string
    }
    expect(res.localPath).toMatch(/hello$/)
    // Final loaded===total is always forwarded even under throttling.
    expect(sentEvents.some((e) => e.channel === 'mt::github::clone-progress')).toBe(true)
    // Cloned folder opened in the requesting window via the existing path.
    const open = emitted.find((e) => e.event === 'app-open-directory-by-id')
    expect(open?.args[0]).toBe(7)
    expect(open?.args[1]).toMatch(/hello$/)
  })

  it('choose-dir returns the picked directory', async() => {
    expect(await call('mt::github::choose-dir')).toBe('/chosen')
  })

  it('clone rejects a non-github / non-https URL', async() => {
    const git = await import('main_renderer/github/git')
    await expect(
      call('mt::github::clone', 'https://attacker.example/x.git', '/tmp')
    ).rejects.toThrow(/github/i)
    await expect(call('mt::github::clone', 'http://github.com/o/r.git', '/tmp')).rejects.toThrow()
    expect(git.cloneRepo).not.toHaveBeenCalled()
  })

  it('choose-dir returns null when the dialog is canceled', async() => {
    showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] })
    expect(await call('mt::github::choose-dir')).toBeNull()
  })

  it('choose-dir returns null with no owning window', async() => {
    currentWindow = null
    expect(await call('mt::github::choose-dir')).toBeNull()
    expect(showOpenDialog).not.toHaveBeenCalled()
  })

  it('clone tolerates the absence of an owning window', async() => {
    currentWindow = null
    const res = (await call('mt::github::clone', 'https://github.com/o/hello.git', '/tmp')) as {
      localPath: string
    }
    expect(res.localPath).toMatch(/hello$/)
    // No window → no progress events and no open-folder emit.
    expect(sentEvents).toHaveLength(0)
    expect(emitted).toHaveLength(0)
  })

  it('auth-start still reports success when the identity fetch fails (token is valid)', async() => {
    ;(auth.pollForToken as ReturnType<typeof vi.fn>).mockResolvedValue('gho_x')
    ;(api.getUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network'))
    await call('mt::github::auth-start')
    await new Promise((resolve) => setTimeout(resolve, 0))
    // Token was obtained → signed in; a transient identity-fetch failure must
    // not be reported as auth failure.
    expect(sentEvents.some((e) => e.channel === 'mt::github::auth-success')).toBe(true)
    expect(sentEvents.some((e) => e.channel === 'mt::github::auth-error')).toBe(false)
  })

  it('auth-start survives the window being destroyed before the poll resolves', async() => {
    ;(auth.pollForToken as ReturnType<typeof vi.fn>).mockResolvedValue('gho_x')
    await call('mt::github::auth-start')
    windowDestroyed = true // user closes the window while the poll is pending
    await new Promise((resolve) => setTimeout(resolve, 0))
    // The token/identity work still completes; no send against the dead window.
    expect(auth.saveIdentity).toHaveBeenCalled()
    expect(sentEvents.some((e) => e.channel === 'mt::github::auth-success')).toBe(false)
  })

  it('auth-start error path survives a destroyed window', async() => {
    ;(auth.pollForToken as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('expired_token'))
    await call('mt::github::auth-start')
    windowDestroyed = true
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(sentEvents.some((e) => e.channel === 'mt::github::auth-error')).toBe(false)
  })

  it('status-changed broadcast skips destroyed windows', async() => {
    windowDestroyed = true
    await call('mt::github::stage', '/repo', ['a.md'])
    expect(sentEvents).toHaveLength(0)
  })

  it('auth-start reports device code even with no owning window', async() => {
    currentWindow = null
    ;(auth.pollForToken as ReturnType<typeof vi.fn>).mockResolvedValue('gho_x')
    const info = (await call('mt::github::auth-start')) as { userCode: string }
    expect(info.userCode).toBe('WDJB')
    await new Promise((resolve) => setTimeout(resolve, 0))
    // Poll resolved but there's no window to notify — must not throw.
    expect(sentEvents).toHaveLength(0)
  })

  it('repo-info and lfs-check pass through', async() => {
    expect(await call('mt::github::repo-info', '/repo')).toEqual({
      isRepo: true,
      remoteUrl: 'u',
      httpsUrl: 'h'
    })
    expect(await call('mt::github::lfs-check', '/repo')).toBe(true)
  })

  it('sign-out clears cached author and calls auth.signOut', async() => {
    await call('mt::github::sign-out')
    expect(auth.signOut).toHaveBeenCalled()
  })

  it('auth-start returns device code and emits auth-success after the poll resolves', async() => {
    ;(auth.pollForToken as ReturnType<typeof vi.fn>).mockResolvedValue('gho_new')
    const info = (await call('mt::github::auth-start')) as { userCode: string }
    expect(info.userCode).toBe('WDJB')
    // Let the background poll .then chain flush.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(auth.saveIdentity).toHaveBeenCalled()
    expect(sentEvents.some((e) => e.channel === 'mt::github::auth-success')).toBe(true)
  })

  it('auth-start emits auth-error when the poll rejects', async() => {
    ;(auth.pollForToken as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('expired_token'))
    await call('mt::github::auth-start')
    await new Promise((resolve) => setTimeout(resolve, 0))
    const err = sentEvents.find((e) => e.channel === 'mt::github::auth-error')
    expect(err?.args[0]).toContain('expired_token')
  })
})
