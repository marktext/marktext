import { GITHUB_API_BASE } from './config'

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
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  })
  if (!res.ok) throw new Error(`GitHub API ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}

export const getUser = async(token: string): Promise<GitHubUser> => {
  const data = await request<{ login: string; name: string | null; id: number }>('/user', token)
  return { login: data.login, name: data.name, id: data.id }
}

// Commits are authored with GitHub's noreply address so they attribute
// correctly on github.com without leaking a private email (spec: Commit
// identity).
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

// Paginated: users routinely exceed one page of repos.
export const listRepos = async(token: string): Promise<GitHubRepo[]> => {
  const repos: GitHubRepo[] = []
  for (let page = 1; ; page++) {
    const data = await request<RawRepo[]>(
      `/user/repos?per_page=100&sort=updated&page=${page}`,
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
    if (data.length < 100) break
  }
  return repos
}
