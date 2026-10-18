import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const startMarker = '<!-- current-sponsors:start -->'
const endMarker = '<!-- current-sponsors:end -->'
const readmePath = fileURLToPath(new URL('../README.md', import.meta.url))

const wallPath = fileURLToPath(new URL('../docs/assets/sponsors/current.svg', import.meta.url))

const query = `query CurrentSponsors($cursor: String) {
  organization(login: "marktext") {
    sponsorshipsAsMaintainer(first: 100, after: $cursor, activeOnly: true) {
      nodes {
        privacyLevel
        sponsorEntity {
          ... on User { login avatarUrl(size: 96) }
          ... on Organization { login avatarUrl(size: 96) }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
}`

export const fetchCurrentSponsors = async (token, request = fetch) => {
  if (!token) throw new Error('SPONSORS_TOKEN is required')
  const sponsors = new Map()
  let cursor = null
  do {
    const response = await request('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, variables: { cursor } }),
      signal: AbortSignal.timeout(30000)
    })
    if (!response.ok) throw new Error(`GitHub API returned HTTP ${response.status}`)
    const result = await response.json()
    if (result.errors?.length) throw new Error('GitHub Sponsors query failed')
    const connection = result.data?.organization?.sponsorshipsAsMaintainer
    if (!connection || !Array.isArray(connection.nodes) || !connection.pageInfo) {
      throw new Error('GitHub Sponsors response is incomplete')
    }
    for (const sponsorship of connection.nodes) {
      if (sponsorship?.privacyLevel !== 'PUBLIC') continue
      const sponsor = sponsorship.sponsorEntity
      if (sponsor) sponsors.set(sponsor.login, sponsor)
    }
    const nextCursor = connection.pageInfo.endCursor
    if (connection.pageInfo.hasNextPage && (!nextCursor || nextCursor === cursor)) {
      throw new Error('GitHub Sponsors pagination did not advance')
    }
    cursor = connection.pageInfo.hasNextPage ? nextCursor : null
  } while (cursor)
  return [...sponsors.values()].sort((a, b) => a.login.localeCompare(b.login, 'en'))
}

const escapeAttribute = (value) => {
  return value.replace(/[&<>"']/g, (character) => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]
  })
}

export const updateReadme = (readme, sponsors) => {
  const start = readme.indexOf(startMarker)
  const end = readme.indexOf(endMarker)
  if (
    start < 0 ||
    end < start ||
    readme.indexOf(startMarker, start + 1) !== -1 ||
    readme.indexOf(endMarker, end + 1) !== -1
  ) {
    throw new Error('README must contain exactly one current-sponsors marker pair')
  }
  const section = sponsors.length
    ? '\n\n**Current Sponsors**\n\n[![Current sponsors](docs/assets/sponsors/current.svg)](https://github.com/sponsors/marktext)\n\n'
    : '\n'
  return readme.slice(0, start + startMarker.length) + section + readme.slice(end)
}

export const renderAvatarWall = async (sponsors, request = fetch) => {
  const size = 48
  const gap = 8
  const columns = Math.min(10, sponsors.length)
  if (!columns) return null
  const width = columns * (size + gap) - gap
  const height = Math.ceil(sponsors.length / columns) * (size + gap) - gap
  const avatars = await Promise.all(
    sponsors.map(async ({ login, avatarUrl }, index) => {
      if (new URL(avatarUrl).protocol !== 'https:') throw new Error('Avatar URL must use HTTPS')
      const response = await request(avatarUrl, { signal: AbortSignal.timeout(30000) })
      if (!response.ok) throw new Error(`Avatar download returned HTTP ${response.status}`)
      const type = response.headers.get('content-type')?.split(';')[0]
      if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(type)) {
        throw new Error('Unsupported avatar image type')
      }
      const data = Buffer.from(await response.arrayBuffer()).toString('base64')
      const x = (index % columns) * (size + gap)
      const y = Math.floor(index / columns) * (size + gap)
      return `<g><title>${escapeAttribute(login)}</title><defs><clipPath id="avatar-${index}"><circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size / 2}"/></clipPath></defs><image x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar-${index})" href="data:${type};base64,${data}"/></g>`
    })
  )
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Current sponsors">${avatars.join('')}</svg>\n`
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sponsors = await fetchCurrentSponsors(process.env.SPONSORS_TOKEN)
  const readme = await readFile(readmePath, 'utf8')
  const updated = updateReadme(readme, sponsors)
  const wall = await renderAvatarWall(sponsors)
  if (wall) {
    await mkdir(path.dirname(wallPath), { recursive: true })
    await writeFile(wallPath, wall)
  } else {
    await rm(wallPath, { force: true })
  }
  if (updated !== readme) await writeFile(readmePath, updated)
  console.log(`Updated README with ${sponsors.length} current public sponsors`)
}
