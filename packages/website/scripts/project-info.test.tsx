import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import Hero from '../src/components/Hero'
import Stats from '../src/components/Stats'
import { PROJECT_INFO } from '../src/lib/project-info'
import { getProjectInfo } from './fetch-project-info'

test('initial HTML includes project data without contacting GitHub', () => {
  const html = renderToStaticMarkup(
    <>
      <Hero />
      <Stats />
    </>
  )
  assert.ok(html.includes(PROJECT_INFO.releaseVersion))
  assert.ok(html.includes(String(PROJECT_INFO.contributors)))
  assert.ok(html.includes(PROJECT_INFO.githubStars.toLocaleString('en-US')))
})

test('build values include every page of contributors', async () => {
  const pages: string[] = []
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/releases/latest')) return Response.json({ tag_name: 'v1.0.0' })
    if (url.pathname.endsWith('/contributors')) {
      pages.push(url.searchParams.get('page')!)
      return Response.json(Array(url.searchParams.get('page') === '1' ? 100 : 5).fill({}))
    }
    return Response.json({ stargazers_count: 70000 })
  }
  assert.deepEqual(await getProjectInfo(new AbortController().signal, fetcher), {
    releaseVersion: 'v1.0.0',
    githubStars: 70000,
    contributors: 105
  })
  assert.deepEqual(pages, ['1', '2'])
})

test('a failed contributor page cannot publish an incomplete count or discard the release', async () => {
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/releases/latest')) return Response.json({ tag_name: 'v1.0.0' })
    if (url.pathname.endsWith('/contributors') && url.searchParams.get('page') === '1') {
      return Response.json(Array(100).fill({}))
    }
    return new Response(null, { status: 403 })
  }
  assert.deepEqual(await getProjectInfo(new AbortController().signal, fetcher), {
    releaseVersion: 'v1.0.0',
    githubStars: undefined,
    contributors: undefined
  })
})

test('network failures settle without rejecting the build update', async () => {
  const fetcher: typeof fetch = async () => {
    throw new TypeError('Failed to fetch')
  }
  assert.deepEqual(await getProjectInfo(new AbortController().signal, fetcher), {
    releaseVersion: undefined,
    githubStars: undefined,
    contributors: undefined
  })
})
