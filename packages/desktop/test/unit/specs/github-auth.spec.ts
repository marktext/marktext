import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const store: Record<string, string | null> = {}
vi.mock('keytar', () => ({
  default: {
    getPassword: vi.fn(async(_s: string, a: string) => store[a] ?? null),
    setPassword: vi.fn(async(_s: string, a: string, v: string) => {
      store[a] = v
    }),
    deletePassword: vi.fn(async(_s: string, a: string) => {
      delete store[a]
      return true
    })
  }
}))

import {
  requestDeviceCode,
  pollForToken,
  getToken,
  signOut,
  saveIdentity,
  loadIdentity
} from 'main_renderer/github/auth'

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k]
  vi.restoreAllMocks()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('github/auth device code', () => {
  it('requestDeviceCode fails fast with a clear message when unconfigured', async() => {
    vi.stubEnv('MARKTEXT_GITHUB_CLIENT_ID', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
    await expect(requestDeviceCode()).rejects.toThrow(/not configured|client id/i)
    // Never hits the network without a client id.
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('requestDeviceCode returns the user-facing code info', async() => {
    vi.stubEnv('MARKTEXT_GITHUB_CLIENT_ID', 'test-client-id')
    vi.stubGlobal('fetch', vi.fn(async() => ({
      ok: true,
      json: async() => ({
        device_code: 'dc',
        user_code: 'WDJB-MJHT',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 5
      })
    })) as unknown as typeof fetch)

    const info = await requestDeviceCode()
    expect(info.userCode).toBe('WDJB-MJHT')
    expect(info.deviceCode).toBe('dc')
    expect(info.verificationUri).toBe('https://github.com/login/device')
    expect(info.expiresIn).toBe(900)
    expect(info.interval).toBe(5)
  })

  it('requestDeviceCode throws on a non-ok response', async() => {
    vi.stubEnv('MARKTEXT_GITHUB_CLIENT_ID', 'test-client-id')
    vi.stubGlobal('fetch', vi.fn(async() => ({ ok: false, status: 500 })) as unknown as typeof fetch)
    await expect(requestDeviceCode()).rejects.toThrow('500')
  })
})

describe('github/auth polling', () => {
  it('pollForToken stores the token once authorization completes', async() => {
    vi.useFakeTimers()
    let calls = 0
    vi.stubGlobal('fetch', vi.fn(async() => ({
      ok: true,
      json: async() => {
        calls++
        return calls < 2 ? { error: 'authorization_pending' } : { access_token: 'gho_abc' }
      }
    })) as unknown as typeof fetch)

    const promise = pollForToken('dc', 1)
    await vi.advanceTimersByTimeAsync(1000) // first poll: pending
    await vi.advanceTimersByTimeAsync(1000) // second poll: success
    const token = await promise
    expect(token).toBe('gho_abc')
    expect(await getToken()).toBe('gho_abc')
  })

  it('pollForToken backs off on slow_down', async() => {
    vi.useFakeTimers()
    let calls = 0
    const fetchMock = vi.fn(async() => ({
      ok: true,
      json: async() => {
        calls++
        return calls < 2 ? { error: 'slow_down', interval: 1 } : { access_token: 'gho_slow' }
      }
    }))
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const promise = pollForToken('dc', 1)
    await vi.advanceTimersByTimeAsync(1000) // first poll returns slow_down (interval now 6)
    await vi.advanceTimersByTimeAsync(6000) // second poll succeeds after backoff
    expect(await promise).toBe('gho_slow')
  })

  it('pollForToken backs off using the current interval when none is supplied', async() => {
    vi.useFakeTimers()
    let calls = 0
    vi.stubGlobal('fetch', vi.fn(async() => ({
      ok: true,
      json: async() => {
        calls++
        return calls < 2 ? { error: 'slow_down' } : { access_token: 'gho_ok' }
      }
    })) as unknown as typeof fetch)

    const promise = pollForToken('dc', 2)
    await vi.advanceTimersByTimeAsync(2000) // first poll: slow_down (interval → 2 + 5 = 7)
    await vi.advanceTimersByTimeAsync(7000) // second poll: success
    expect(await promise).toBe('gho_ok')
  })

  it('pollForToken rejects with "unknown" on an unrecognized empty error', async() => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async() => ({
      ok: true,
      json: async() => ({})
    })) as unknown as typeof fetch)

    const promise = pollForToken('dc', 1)
    const assertion = expect(promise).rejects.toThrow('unknown')
    await vi.advanceTimersByTimeAsync(1000)
    await assertion
  })

  it('pollForToken rejects when the device code expires', async() => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async() => ({
      ok: true,
      json: async() => ({ error: 'expired_token' })
    })) as unknown as typeof fetch)

    const promise = pollForToken('dc', 1)
    const assertion = expect(promise).rejects.toThrow('expired_token')
    await vi.advanceTimersByTimeAsync(1000)
    await assertion
  })

  it('starting a new poll cancels the in-flight one', async() => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async() => ({
      ok: true,
      json: async() => ({ error: 'authorization_pending' })
    })) as unknown as typeof fetch)
    const first = pollForToken('dc-old', 1)
    const firstRejects = expect(first).rejects.toThrow('cancelled')

    vi.stubGlobal('fetch', vi.fn(async() => ({
      ok: true,
      json: async() => ({ access_token: 'gho_new' })
    })) as unknown as typeof fetch)
    const second = pollForToken('dc-new', 1)

    await vi.advanceTimersByTimeAsync(1000)
    await firstRejects
    expect(await second).toBe('gho_new')
  })
})

describe('github/auth identity + sign out', () => {
  it('persists and reloads the user identity', async() => {
    await saveIdentity({ login: 'octocat', name: 'The Octocat', id: 583231 })
    expect(await loadIdentity()).toEqual({ login: 'octocat', name: 'The Octocat', id: 583231 })
  })

  it('loadIdentity returns null when nothing is stored', async() => {
    expect(await loadIdentity()).toBeNull()
  })

  it('loadIdentity returns null on corrupt stored data', async() => {
    store['user-identity'] = 'not-json{'
    expect(await loadIdentity()).toBeNull()
  })

  it('signOut clears the stored token and identity', async() => {
    store['oauth-token'] = 'gho_abc'
    store['user-identity'] = '{"login":"octocat","name":null,"id":583231}'
    await signOut()
    expect(await getToken()).toBeNull()
    expect(await loadIdentity()).toBeNull()
  })

  it('signOut cancels an in-flight device-flow poll', async() => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async() => ({
      ok: true,
      json: async() => ({ access_token: 'gho_late' })
    })) as unknown as typeof fetch)

    const poll = pollForToken('dc', 1)
    const assertion = expect(poll).rejects.toThrow('cancelled')
    await signOut()
    await vi.advanceTimersByTimeAsync(1000)
    await assertion
    // The late authorization must NOT silently re-sign the user in.
    expect(await getToken()).toBeNull()
  })
})
