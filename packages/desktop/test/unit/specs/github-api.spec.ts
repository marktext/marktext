import { describe, it, expect, vi, afterEach } from 'vitest'
import { getUser, listRepos, commitAuthorFor } from 'main_renderer/github/api'

afterEach(() => vi.restoreAllMocks())

describe('github/api', () => {
  it('getUser returns the fields the commit author is built from', async() => {
    vi.stubGlobal('fetch', vi.fn(async() => ({
      ok: true,
      json: async() => ({ login: 'octocat', name: 'The Octocat', id: 583231 })
    })) as unknown as typeof fetch)
    expect(await getUser('tok')).toEqual({ login: 'octocat', name: 'The Octocat', id: 583231 })
  })

  it('getUser sends the bearer token and API version headers', async() => {
    const fetchMock = vi.fn(async() => ({
      ok: true,
      json: async() => ({ login: 'octocat', name: null, id: 1 })
    }))
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
    await getUser('secret-token')
    const [url, opts] = fetchMock.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> }
    ]
    expect(url).toBe('https://api.github.com/user')
    expect(opts.headers.Authorization).toBe('Bearer secret-token')
    expect(opts.headers['X-GitHub-Api-Version']).toBe('2022-11-28')
  })

  it('commitAuthorFor builds the noreply identity', () => {
    expect(commitAuthorFor({ login: 'octocat', name: 'The Octocat', id: 583231 })).toEqual({
      name: 'The Octocat',
      email: '583231+octocat@users.noreply.github.com'
    })
  })

  it('commitAuthorFor falls back to the login when the profile name is empty', () => {
    expect(commitAuthorFor({ login: 'octocat', name: null, id: 583231 }).name).toBe('octocat')
  })

  it('listRepos maps the fields we care about', async() => {
    vi.stubGlobal('fetch', vi.fn(async() => ({
      ok: true,
      json: async() => [
        {
          full_name: 'octocat/hello',
          clone_url: 'https://github.com/octocat/hello.git',
          private: false,
          default_branch: 'main'
        }
      ]
    })) as unknown as typeof fetch)
    const repos = await listRepos('tok')
    expect(repos[0]).toEqual({
      fullName: 'octocat/hello',
      cloneUrl: 'https://github.com/octocat/hello.git',
      private: false,
      defaultBranch: 'main'
    })
  })

  it('listRepos follows pagination until a short page', async() => {
    const raw = (i: number) => ({
      full_name: `octocat/repo-${i}`,
      clone_url: `https://github.com/octocat/repo-${i}.git`,
      private: false,
      default_branch: 'main'
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async() => Array.from({ length: 100 }, (_, i) => raw(i)) })
      .mockResolvedValueOnce({ ok: true, json: async() => [raw(100)] })
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
    const repos = await listRepos('tok')
    expect(repos).toHaveLength(101)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1][0])).toContain('page=2')
  })

  it('listRepos stops after a single short page', async() => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async() => [] })
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
    expect(await listRepos('tok')).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws on a non-ok response', async() => {
    vi.stubGlobal('fetch', vi.fn(async() => ({ ok: false, status: 401 })) as unknown as typeof fetch)
    await expect(getUser('bad')).rejects.toThrow('401')
  })
})
