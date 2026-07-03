import { GITHUB_API_BASE, FETCH_TIMEOUT_MS } from './config'

// Repos page size, shared by the request URL and the pagination stop condition
// so the two can't drift.
const PER_PAGE = 100

export interface GitHubUser {
  login: string
  name: string | null
  id: number
}

export interface GitHubRepo {
  fullName: string
  cloneUrl: string
  private: boolean
  defaultBranch: string
}

const request = async <T>(path: string, token: string): Promise<T> => {
  const res = await fetch(`${GITHUB_API_BASE}${path}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  })
  if (!res.ok) throw new Error(`GitHub API ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}

/**
 * Fetch the authenticated user's profile. Only the fields needed to build the
 * commit author are returned.
 *
 * @param token - GitHub access token.
 * @returns The user's `login`, display `name` (may be null), and numeric `id`.
 * @throws If the request fails (e.g. 401 on an invalid/expired token).
 */
export const getUser = async(token: string): Promise<GitHubUser> => {
  const data = await request<{ login: string; name: string | null; id: number }>('/user', token)
  return { login: data.login, name: data.name, id: data.id }
}

/**
 * Derive a git commit author from a GitHub profile. Uses GitHub's `noreply`
 * address so commits attribute correctly on github.com without leaking a
 * private email, and falls back to the login when the profile has no name.
 *
 * @param user - Profile from {@link getUser}.
 * @returns A `{ name, email }` suitable for isomorphic-git's `commit`.
 */
export const commitAuthorFor = (user: GitHubUser): { name: string; email: string } => ({
  name: user.name || user.login,
  email: `${user.id}+${user.login}@users.noreply.github.com`
})

interface RawRepo {
  full_name: string
  clone_url: string
  private: boolean
  default_branch: string
}

/**
 * List every repository the authenticated user can access, following
 * pagination to completion (users routinely exceed a single 100-item page).
 *
 * @param token - GitHub access token.
 * @returns All repos, most-recently-updated first, mapped to {@link GitHubRepo}.
 */
export const listRepos = async(token: string): Promise<GitHubRepo[]> => {
  const repos: GitHubRepo[] = []
  for (let page = 1; ; page++) {
    const data = await request<RawRepo[]>(
      `/user/repos?per_page=${PER_PAGE}&sort=updated&page=${page}`,
      token
    )
    repos.push(
      ...data.map((r) => ({
        fullName: r.full_name,
        cloneUrl: r.clone_url,
        private: r.private,
        defaultBranch: r.default_branch
      }))
    )
    if (data.length < PER_PAGE) break
  }
  return repos
}
