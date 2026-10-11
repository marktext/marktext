import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { getProjectInfo } from '../src/lib/project-info.ts'

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})

test('reads fresh values on each call and counts every contributor page', async () => {
  let stars = 12_345
  let version = 'v1.2.3'
  const contributorPages = []
  globalThis.fetch = async (url, options) => {
    assert.equal(options.cache, 'no-store')
    const { pathname, searchParams } = new URL(url)
    if (pathname.endsWith('/releases/latest')) return Response.json({ tag_name: version })
    if (pathname.endsWith('/contributors')) {
      const page = Number(searchParams.get('page'))
      contributorPages.push(page)
      assert.equal(searchParams.get('per_page'), '100')
      return Response.json(Array.from({ length: page < 3 ? 100 : 7 }, (_, id) => ({ id })))
    }
    return Response.json({ stargazers_count: stars })
  }

  assert.deepEqual(await getProjectInfo(new AbortController().signal), {
    releaseVersion: 'v1.2.3',
    githubStars: 12_345,
    contributors: 207
  })
  stars = 54_321
  version = 'v2.0.0'
  assert.deepEqual(await getProjectInfo(new AbortController().signal), {
    releaseVersion: 'v2.0.0',
    githubStars: 54_321,
    contributors: 207
  })
  assert.deepEqual(contributorPages, [1, 2, 3, 1, 2, 3])
})

test('keeps available data when releases or contributor pagination are rate limited', async () => {
  globalThis.fetch = async (url) => {
    const { pathname, searchParams } = new URL(url)
    if (pathname.endsWith('/releases/latest') || searchParams.get('page') === '2') {
      return Response.json({ message: 'API rate limit exceeded' }, { status: 403 })
    }
    if (pathname.endsWith('/contributors')) return Response.json(Array(100).fill({ id: 1 }))
    return Response.json({ stargazers_count: 0 })
  }
  assert.deepEqual(await getProjectInfo(new AbortController().signal), {
    releaseVersion: undefined,
    githubStars: 0,
    contributors: undefined
  })
})

test('does not display fabricated data for malformed API responses', async () => {
  globalThis.fetch = async (url) =>
    Response.json(url.endsWith('/releases/latest') ? { tag_name: '' } : { stargazers_count: -1 })
  assert.deepEqual(await getProjectInfo(new AbortController().signal), {
    releaseVersion: undefined,
    githubStars: undefined,
    contributors: undefined
  })
})

test('keeps successful values when a slow request is aborted', async () => {
  const controller = new AbortController()
  globalThis.fetch = async (url, { signal }) => {
    if (url.includes('/contributors')) {
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true })
        queueMicrotask(() => controller.abort())
      })
    }
    return Response.json(
      url.endsWith('/releases/latest') ? { tag_name: 'v3.0.0' } : { stargazers_count: 456 }
    )
  }
  assert.deepEqual(await getProjectInfo(controller.signal), {
    releaseVersion: 'v3.0.0',
    githubStars: 456,
    contributors: undefined
  })
})
