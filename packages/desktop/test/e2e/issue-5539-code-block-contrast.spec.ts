import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, clickMenuById, setSourceMarkdown } from './helpers'

// #5539 — code-block text rendered at `--editor-color-50`, so it was both too
// faint to read and blurry (an alpha-composited layer drops Chromium's subpixel
// antialiasing, the same failure #4466/#4631 fixed for body text).
test.describe('Issue #5539 code block text contrast', () => {
  let app: ElectronApplication
  let page: Page

  const readColors = async(): Promise<Record<string, string>> => {
    return await page.evaluate(() => {
      const read = (selector: string): string => {
        const el = document.querySelector(selector) as HTMLElement | null
        return el ? getComputedStyle(el).color : ''
      }
      return {
        code: read('.editor-component .mu-code-block code.mu-code .mu-content'),
        math: read('.editor-component .mu-math-container'),
        frontMatter: read('.editor-component .mu-frontmatter')
      }
    })
  }

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('# code contrast\n')
    app = launched.app
    page = launched.page
    await setSourceMarkdown(
      page,
      app,
      '---\ntitle: front matter\n---\n\n```text\n10H read DATA+CS\n```\n\n$$\na^2 + b^2\n$$\n'
    )
    await page.waitForSelector('.editor-component .mu-code-block code.mu-code .mu-content', {
      timeout: 15000
    })
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  // Each theme's opaque code foreground, as its Prism theme declares it.
  const cases: Array<[string, string]> = [
    ['light', 'rgb(77, 77, 77)'],
    ['ayu-light', 'rgb(87, 95, 102)'],
    ['dark', 'rgb(248, 248, 242)'],
    // graphite's --editorColor is translucent, so the code foreground cannot
    // simply follow it.
    ['graphite', 'rgb(80, 85, 88)']
  ]

  for (const [theme, expected] of cases) {
    test(`${theme} renders code block text opaque at full strength`, async() => {
      await clickMenuById(app, theme)
      await expect.poll(async() => (await readColors()).code, { timeout: 10000 }).toBe(expected)

      const colors = await readColors()
      expect(colors.math).toBe(expected)
      expect(colors.frontMatter).toBe(expected)
    })
  }
})
