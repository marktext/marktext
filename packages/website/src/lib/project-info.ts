const REPOSITORY_API = 'https://api.github.com/repos/marktext/marktext'

// Last verified on GitHub on 2026-10-11; live API data takes precedence.
export const DEFAULT_GITHUB_STARS = 62_403

export type ProjectInfo = {
  releaseVersion?: string
  githubStars?: number
  contributors?: number
}

async function readGitHub(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(`${REPOSITORY_API}${path}`, {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store',
    signal
  })
  if (!response.ok) throw new Error(`GitHub returned ${response.status}`)
  return response.status === 204 ? [] : response.json()
}

async function getStars(signal: AbortSignal): Promise<number> {
  const repository = await readGitHub('', signal)
  if (
    typeof repository !== 'object' ||
    repository === null ||
    !('stargazers_count' in repository) ||
    typeof repository.stargazers_count !== 'number' ||
    !Number.isSafeInteger(repository.stargazers_count) ||
    repository.stargazers_count < 0
  )
    throw new Error('Invalid GitHub star count')
  return repository.stargazers_count
}

async function getRelease(signal: AbortSignal): Promise<string> {
  const release = await readGitHub('/releases/latest', signal)
  if (
    typeof release !== 'object' ||
    release === null ||
    !('tag_name' in release) ||
    typeof release.tag_name !== 'string' ||
    !release.tag_name.trim()
  )
    throw new Error('Invalid GitHub release')
  return release.tag_name
}

async function getContributors(signal: AbortSignal): Promise<number> {
  let count = 0
  for (let page = 1; ; page++) {
    // Count all registered accounts, including bots; the API excludes anonymous contributors.
    const contributors = await readGitHub(`/contributors?per_page=100&page=${page}`, signal)
    if (!Array.isArray(contributors)) throw new Error('Invalid GitHub contributors')
    count += contributors.length
    if (contributors.length < 100) return count
  }
}

export async function getProjectInfo(signal: AbortSignal): Promise<ProjectInfo> {
  // A rate-limited or unavailable endpoint must not discard the other successful values.
  const [release, stars, contributors] = await Promise.allSettled([
    getRelease(signal),
    getStars(signal),
    getContributors(signal)
  ])
  return {
    releaseVersion: release.status === 'fulfilled' ? release.value : undefined,
    githubStars: stars.status === 'fulfilled' ? stars.value : undefined,
    contributors: contributors.status === 'fulfilled' ? contributors.value : undefined
  }
}
