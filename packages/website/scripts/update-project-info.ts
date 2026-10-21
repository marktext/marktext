import { writeFile } from 'node:fs/promises'
import { PROJECT_INFO } from '../src/lib/project-info'
import { getProjectInfo } from './fetch-project-info'

const token = process.env.GITHUB_TOKEN
const authenticatedFetch: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}

// Ship the last verified values when GitHub is unavailable during a build.
const info = await getProjectInfo(AbortSignal.timeout(10_000), authenticatedFetch)
const snapshot = { ...PROJECT_INFO }
for (const key of ['releaseVersion', 'githubStars', 'contributors'] as const) {
  if (info[key] === undefined) console.warn(`GitHub ${key} unavailable; keeping snapshot`)
}
snapshot.releaseVersion = info.releaseVersion ?? snapshot.releaseVersion
snapshot.githubStars = info.githubStars ?? snapshot.githubStars
snapshot.contributors = info.contributors ?? snapshot.contributors

await writeFile(
  new URL('../src/lib/project-info.snapshot.json', import.meta.url),
  `${JSON.stringify(snapshot, null, 2)}\n`
)
