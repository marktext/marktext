import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'

const origin = 'http://127.0.0.1:8788'
const worker = spawn(
  'pnpm',
  ['exec', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', '8788'],
  { stdio: 'inherit', detached: true }
)
let workerError
worker.on('error', (error) => {
  workerError = error
})

try {
  const deadline = Date.now() + 60_000
  while (true) {
    if (workerError) throw workerError
    assert.equal(worker.exitCode, null, 'Worker exited before becoming ready')
    try {
      // Any HTTP response means the server is ready; a 500 must fail below.
      await fetch(origin, { signal: AbortSignal.timeout(1000) })
      break
    } catch (error) {
      if (Date.now() >= deadline) throw error
      await setTimeout(250)
    }
  }

  for (const [path, contentType, content] of [
    ['/', 'text/html', 'MarkText'],
    ['/sponsors', 'text/html', 'Support MarkText.'],
    ['/docs', 'text/html', 'MarkText'],
    ['/docs/dev/architecture', 'text/html', 'Project Architecture'],
    ['/robots.txt', 'text/plain', 'Sitemap:'],
    ['/sitemap.xml', 'xml', 'https://marktext.me'],
    ['/docs-index.json', 'application/json', 'introduction']
  ]) {
    const response = await fetch(`${origin}${path}`, {
      signal: AbortSignal.timeout(10_000)
    })
    const body = await response.text()
    assert.equal(response.status, 200, `${path}: ${body.slice(0, 1000)}`)
    assert.ok(response.headers.get('content-type')?.includes(contentType), path)
    assert.ok(body.includes(content), `${path}: expected ${content}`)
    if (path === '/sponsors') {
      assert.ok(body.includes('<title>Sponsor MarkText | Support Open Source Development</title>'))
      assert.ok(body.includes('rel="canonical" href="https://marktext.me/sponsors"'))
      assert.ok(
        body.includes(
          'name="description" content="Support MarkText, the free and open-source Markdown editor. Explore individual and corporate sponsorship opportunities."'
        )
      )
      assert.ok(
        body.includes('property="og:title" content="Sponsor MarkText — Keep Open Source Alive"')
      )
      assert.ok(body.includes('property="og:url" content="https://marktext.me/sponsors"'))
      assert.ok(body.includes('https://marktext.me/assets/logo.png'))
      assert.ok(body.includes('name="twitter:card" content="summary"'))
      assert.equal((body.match(/<h1[ >]/g) || []).length, 1)
      assert.ok(!/<meta[^>]+content="[^"]*noindex/.test(body))
      for (const content of [
        'Supporter',
        'Late Night Debugging',
        'Community Sponsor',
        'Gold Sponsor',
        'Platinum Sponsor',
        'Early Supporter',
        '/assets/serpapi.png',
        'https://serpapi.com/?utm_source=marktext',
        'mailto:ransixi@gmail.com?subject=MarkText%20Corporate%20Sponsorship'
      ]) {
        assert.ok(body.includes(content), `Missing sponsorship content: ${content}`)
      }
    }
    if (path === '/') {
      assert.ok(body.includes('Explore Sponsorships'))
      assert.ok(body.includes('/assets/serpapi.png'))
      assert.ok(body.includes('https://serpapi.com/?utm_source=marktext'))
    }
    if (path === '/sitemap.xml') assert.ok(body.includes('https://marktext.me/sponsors'))
    if (path === '/robots.txt') assert.ok(!body.includes('Disallow: /sponsors'))
    console.log(`PASS ${path}`)
  }
} finally {
  // Wrangler launches workerd as a child; stop the whole preview process group.
  if (worker.pid) {
    try {
      process.kill(-worker.pid, 'SIGTERM')
    } catch (error) {
      if (error.code !== 'ESRCH') throw error
    }
  }
}
