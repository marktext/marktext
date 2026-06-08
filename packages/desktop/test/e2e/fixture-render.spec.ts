import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithDoc } from './helpers'

type FixtureAssertion = (ctx: { page: Page }) => Promise<void>

const runFixture = (name: string, relativePath: string, assertion: FixtureAssertion): void => {
  test.describe(`Fixture: ${name}`, () => {
    let app: ElectronApplication | null = null
    let page: Page

    test.beforeAll(async() => {
      const launched = await launchWithDoc(relativePath)
      app = launched.app
      page = launched.page
      // Allow Muya to finish rendering blocks.
      await page.waitForTimeout(800)
    })

    test.afterAll(async() => {
      if (app) await app.close()
    })

    test(`${name} renders expected DOM`, async() => {
      await assertion({ page })
    })
  })
}

runFixture('table', 'test/e2e/data/table.md', async({ page }) => {
  await page.waitForSelector('.editor-component table', { state: 'attached', timeout: 10000 })
  // The @muyajs/core engine renders rows directly under <table> (no <tbody>).
  const cellCount = await page.locator('.editor-component table td').count()
  expect(cellCount).toBeGreaterThanOrEqual(6)
})

runFixture('lists', 'test/e2e/data/lists.md', async({ page }) => {
  await page.waitForSelector('.editor-component ul li', { state: 'attached', timeout: 10000 })
  await page.waitForSelector('.editor-component ol li', { state: 'attached', timeout: 10000 })
  const checkboxes = await page.locator('.editor-component input[type="checkbox"]').count()
  expect(checkboxes).toBeGreaterThanOrEqual(2)
})

runFixture('code', 'test/e2e/data/code.md', async({ page }) => {
  const codeBlocks = await page
    .locator('.editor-component pre, .editor-component .mu-code-block, .editor-component code')
    .count()
  expect(codeBlocks).toBeGreaterThan(0)
})

runFixture('blockquote', 'test/e2e/data/blockquote.md', async({ page }) => {
  await page.waitForSelector('.editor-component blockquote', { state: 'attached', timeout: 10000 })
  const count = await page.locator('.editor-component blockquote').count()
  expect(count).toBeGreaterThanOrEqual(1)
})

runFixture('link-image', 'test/e2e/data/link-image.md', async({ page }) => {
  // The engine renders an inline markdown link as an editable
  // `span.mu-link[href]`, not an `<a href>`.
  await page.waitForSelector('.editor-component .mu-link[href]', {
    state: 'attached',
    timeout: 10000
  })
  const linkCount = await page.locator('.editor-component .mu-link[href]').count()
  expect(linkCount).toBeGreaterThanOrEqual(1)
})

runFixture('gfm', 'test/e2e/data/gfm.md', async({ page }) => {
  const strike = await page.locator('.editor-component del, .editor-component s').count()
  const checkboxes = await page.locator('.editor-component input[type="checkbox"]').count()
  expect(strike + checkboxes).toBeGreaterThan(0)
})

runFixture('frontmatter', 'test/e2e/data/frontmatter.md', async({ page }) => {
  const hasFront = await page
    .locator('.editor-component .mu-front-matter, .editor-component pre.mu-front-matter')
    .first()
    .waitFor({ state: 'attached', timeout: 10000 })
    .then(() => true)
    .catch(() => false)
  const h1 = await page.locator('.editor-component h1').count()
  expect(hasFront || h1 > 0).toBe(true)
})

runFixture('math', 'test/e2e/data/math.md', async({ page }) => {
  // KaTeX renders to .katex; fall back to muya math container if KaTeX has not run yet.
  const ok = await page
    .locator('.editor-component .katex, .editor-component .mu-math-block')
    .first()
    .waitFor({ state: 'attached', timeout: 15000 })
    .then(() => true)
    .catch(() => false)
  expect(ok).toBe(true)
})

runFixture('formatted', 'test/e2e/data/formatted.md', async({ page }) => {
  const strong = await page.locator('.editor-component strong').count()
  const em = await page.locator('.editor-component em').count()
  const code = await page.locator('.editor-component code').count()
  expect(strong).toBeGreaterThan(0)
  expect(em).toBeGreaterThan(0)
  expect(code).toBeGreaterThan(0)
})

// Regression coverage for marktext#4341 — a ul nested inside an ol li (and
// vice versa) was rewritten into a paragraph by the legacy muya lexer.
runFixture('nested-mixed-lists', 'test/e2e/data/nested-mixed-lists.md', async({ page }) => {
  await page.waitForSelector('.editor-component ol li ul li', { state: 'attached', timeout: 10000 })
  await page.waitForSelector('.editor-component ul li ol li', { state: 'attached', timeout: 10000 })
  const ulInOl = await page.locator('.editor-component ol > li ul > li').count()
  const olInUl = await page.locator('.editor-component ul > li ol > li').count()
  expect(ulInOl).toBeGreaterThanOrEqual(3)
  expect(olInUl).toBeGreaterThanOrEqual(3)
})
