import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, sendIpcToRenderer, expectNoRendererErrors, clickMenuById } from './helpers'

// Inline formulas make each paragraph DOM-heavy, as in real math notes, so the
// document crosses the virtualization threshold.
const paragraph = (i: number) =>
  `Paragraph ${i}: 数列 $a_{n+1}=f(a_n)$ 的不动点 $x^*=f(x^*)$，偏离量 $a_n-x^*$ 与 $\\frac{1}{a_n-1}$ 一起变化。`
const tallCode = '```js\n' + Array.from({ length: 80 }, (_, i) => `const tallCodeLine${i} = ${i}`).join('\n') + '\n```\n\n'
const markdown =
  Array.from({ length: 60 }, (_, s) =>
    `## Section ${s}\n\n` +
    Array.from({ length: 4 }, (_, i) => paragraph(s * 4 + i)).join('\n\n') +
    `\n\nShort line ${s}.\n\n- list item ${s} with $y=x$\n- second item\n\n> quote ${s}\n\n` +
    (s === 36 ? tallCode : '') +
    `$$\n\\sum_{k=1}^{${s + 1}} k = \\frac{n(n+1)}{2}\n$$\n\n| a | b |\n| --- | --- |\n| ${s} | $b_${s}$ |\n`
  ).join('\n')

const blockGeometry = (page: Page) =>
  page.evaluate(() => {
    const root = document.querySelector('.mu-container')!
    const top = root.getBoundingClientRect().top
    return Array.from(root.children, (el) => {
      const rect = el.getBoundingClientRect()
      return [Math.round((rect.top - top) * 100) / 100, Math.round(rect.height * 100) / 100]
    })
  })

// The first block across the viewport top and its offset from it, CSS px.
const topBlock = (page: Page) =>
  page.evaluate(() => {
    const scroller = document.querySelector<HTMLElement>('.editor-component')!
    const top = scroller.getBoundingClientRect().top
    const block = Array.from(document.querySelector('.mu-container')!.children).find(
      (el) => el.getBoundingClientRect().bottom > top
    )!
    return { text: block.textContent, offset: block.getBoundingClientRect().top - top }
  })

const scrollTo = (page: Page, fraction: number) =>
  page.evaluate((value) => {
    const scroller = document.querySelector<HTMLElement>('.editor-component')!
    scroller.scrollTop = scroller.scrollHeight * value
    scroller.dispatchEvent(new Event('scroll'))
  }, fraction)

// Resolves once the scroll position has held for ten frames.
const settle = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const scroller = document.querySelector<HTMLElement>('.editor-component')!
        let last = -1
        let still = 0
        const tick = () => {
          if (scroller.scrollTop === last) {
            if (++still >= 10) return resolve()
          } else {
            still = 0
            last = scroller.scrollTop
          }
          requestAnimationFrame(tick)
        }
        tick()
      })
  )

const switchAwayAndBack = async(app: ElectronApplication, page: Page, virtualized = true) => {
  await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, 'short\n')
  await expect(page.locator('.tabs-container > li')).toHaveCount(2)
  await sendIpcToRenderer(app, 'mt::switch-tab-by-index', 0)
  if (virtualized) await expect(page.locator('.mu-container')).toHaveClass(/mt-virtualized/)
  else await expect(page.locator('.tabs-container > li').first()).toHaveClass(/active/)
}

// The first painted frame of the restored tab.
const firstFrame = (page: Page) =>
  page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))

test.describe('Long document virtualization', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeEach(async() => {
    const launched = await launchWithMarkdown(markdown, {
      suppressErrorDialog: true,
      preferences: { tabBarVisibility: true, sideBarVisibility: true, spellcheckerEnabled: false }
    })
    app = launched.app
    page = launched.page
    await expect(page.locator('.mu-container')).toHaveClass(/mt-virtualized/)
  })

  test.afterEach(async() => {
    if (app) {
      await expectNoRendererErrors(app)
      await app.close()
    }
  })

  test('lays out every block exactly where an unvirtualized document would', async() => {
    const root = page.locator('.mu-container')
    // Every block the stylesheet skips, drawn with the containment it gets on screen.
    const contained = await root.evaluate((el) =>
      Array.from(el.children).filter((child) => getComputedStyle(child).contentVisibility === 'auto').length
    )
    expect(contained).toBeGreaterThan(100)
    await root.evaluate((el) => el.classList.remove('mt-virtualized'))
    const full = await blockGeometry(page)
    await root.evaluate((el) => {
      el.classList.add('mt-virtualized')
      for (const child of Array.from(el.children) as HTMLElement[]) {
        if (getComputedStyle(child).contentVisibility !== 'auto') continue
        child.style.contentVisibility = 'visible'
        child.style.contain = 'layout style paint'
      }
    })
    expect(await blockGeometry(page)).toEqual(full)
  })

  test('keeps the visible text still while estimated blocks above it render', async() => {
    const box = (await page.locator('.editor-component').boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await scrollTo(page, 0.6)
    await settle(page)
    const before = await topBlock(page)
    const scrollTop = () => page.locator('.editor-component').evaluate((el) => el.scrollTop)
    const start = await scrollTop()
    // Scroll up through never-rendered blocks, then back by the same amount.
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -300)
    await settle(page)
    expect(await scrollTop()).toBeLessThan(start - 1000)
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 300)
    await settle(page)
    const after = await topBlock(page)
    expect(after.text).toBe(before.text)
    expect(Math.abs(after.offset - before.offset)).toBeLessThan(2)
  })

  test('restores the reading position exactly when returning to the tab', async() => {
    await scrollTo(page, 0.6)
    const before = await topBlock(page)
    await switchAwayAndBack(app, page)
    await firstFrame(page)
    const after = await topBlock(page)
    expect(after.text).toBe(before.text)
    expect(Math.abs(after.offset - before.offset)).toBeLessThan(1)
  })

  test('restores a position deep inside a block taller than its estimate', async() => {
    await page.evaluate(() => {
      const code = Array.from(document.querySelector('.mu-container')!.children).find((el) =>
        el.textContent!.includes('tallCodeLine0 ')
      )!
      code.id = 'tall-code'
      code.scrollIntoView()
    })
    // Drawn, so it has its real height.
    await settle(page)
    await page.evaluate(() => {
      const scroller = document.querySelector<HTMLElement>('.editor-component')!
      const code = document.getElementById('tall-code')!
      scroller.scrollTop += code.getBoundingClientRect().top - scroller.getBoundingClientRect().top + 400
      scroller.dispatchEvent(new Event('scroll'))
    })
    await settle(page)
    const before = await topBlock(page)
    expect(before.text).toContain('tallCodeLine0 ')
    expect(before.offset).toBeLessThan(-350)
    await switchAwayAndBack(app, page)
    await firstFrame(page)
    const after = await topBlock(page)
    expect(after.text).toBe(before.text)
    expect(Math.abs(after.offset - before.offset)).toBeLessThan(1)
    // Nothing moves once the blocks around it are measured.
    await settle(page)
    expect(Math.abs((await topBlock(page)).offset - before.offset)).toBeLessThan(1)
  })

  test('keeps the view still when typing replaces a block', async() => {
    await scrollTo(page, 0.6)
    await settle(page)
    const target = await page.evaluate(() => {
      const scroller = document.querySelector<HTMLElement>('.editor-component')!
      const top = scroller.getBoundingClientRect().top
      const blocks = Array.from(document.querySelector('.mu-container')!.children)
      const index = blocks.findIndex(
        // One line, shorter than the distance from the window top to the viewport.
        (el) => el.textContent!.startsWith('Short line') && el.getBoundingClientRect().top > top + 200
      )
      const rect = blocks[index].getBoundingClientRect()
      return { index, x: rect.left + 4, y: rect.top + rect.height / 2 }
    })
    const above = () =>
      page.evaluate((index) => {
        const block = document.querySelector('.mu-container')!.children[index - 1]
        return block.getBoundingClientRect().top
      }, target.index)
    await page.mouse.click(target.x, target.y)
    await page.keyboard.press('Home')
    const before = await above()
    // `# ` turns the paragraph into a heading: the block is replaced.
    await page.keyboard.type('# ')
    await expect(page.locator('.mu-container').locator(':scope > *').nth(target.index)).toHaveClass(/mu-atx-heading/)
    await settle(page)
    expect(Math.abs((await above()) - before)).toBeLessThan(1)
  })

  test('keeps the reading position when a preference re-renders every block', async() => {
    await scrollTo(page, 0.6)
    await settle(page)
    const before = await topBlock(page)
    const first = await page.locator('.mu-container > *').first().elementHandle()
    await sendIpcToRenderer(app, 'mt::user-preference', { superSubScript: true })
    await expect.poll(() => first!.evaluate((el) => el.isConnected)).toBe(false)
    await settle(page)
    const after = await topBlock(page)
    expect(after.text).toBe(before.text)
    expect(Math.abs(after.offset - before.offset)).toBeLessThan(1)
  })

  test('draws the inline math preview above the next block', async() => {
    await scrollTo(page, 0.6)
    await settle(page)
    const math = page
      .locator('.mu-container > .mu-paragraph')
      .filter({ has: page.locator('.mu-math') })
      .nth(8)
      .locator('.mu-math')
      .first()
    await math.click()
    const popup = math.locator('.mu-math-render')
    await expect(popup).toBeVisible()
    const covered = await popup.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.bottom - 2)
      return hit && !element.contains(hit) ? hit.outerHTML.slice(0, 120) : ''
    })
    expect(covered).toBe('')
  })

  test('jumps to a far outline heading right after a tab switch, before blocks are measured', async() => {
    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, 'short\n')
    await expect(page.locator('.tabs-container > li')).toHaveCount(2)
    await clickMenuById(app, 'tocMenuItem')
    await sendIpcToRenderer(app, 'mt::switch-tab-by-index', 0)
    await expect(page.locator('.side-bar-toc').getByText('Section 52', { exact: true })).toBeVisible()
    await page.locator('.side-bar-toc').getByText('Section 52', { exact: true }).click()
    const heading = page.locator('.mu-container > h2', { hasText: /Section 52$/ })
    // `scrollToHeader` leaves headings 24px below the viewport top.
    await expect
      .poll(
        () =>
          heading.evaluate((el) => {
            const scroller = document.querySelector<HTMLElement>('.editor-component')!
            return Math.round(el.getBoundingClientRect().top - scroller.getBoundingClientRect().top)
          }),
        { timeout: 8000 }
      )
      .toBeCloseTo(24, -1)
  })
  test('a tab switch stops the smooth scroll of the document it leaves', async() => {
    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, markdown)
    await expect(page.locator('.tabs-container > li')).toHaveCount(2)
    await scrollTo(page, 0.5)
    await settle(page)
    const saved = await topBlock(page)
    await sendIpcToRenderer(app, 'mt::switch-tab-by-index', 0)
    await clickMenuById(app, 'tocMenuItem')
    await page.locator('.side-bar-toc').getByText('Section 52', { exact: true }).click()
    // Still animating towards the heading of the first tab.
    await sendIpcToRenderer(app, 'mt::switch-tab-by-index', 1)
    await expect(page.locator('.tabs-container > li.active')).toHaveCount(1)
    await page.waitForTimeout(600)
    await settle(page)
    const after = await topBlock(page)
    expect(after.text).toBe(saved.text)
    expect(Math.abs(after.offset - saved.offset)).toBeLessThan(1)
  })
})

// Below the virtualization threshold the pixel offset is restored.
test.describe('Scroll restore in a short document', () => {
  test('reaches a position below a diagram that first draws a placeholder', async() => {
    const graph = Array.from({ length: 24 }, (_, i) => `  N${i}[Step ${i}] --> N${i + 1}[Step ${i + 1}]`).join('\n')
    const tail = Array.from({ length: 30 }, (_, i) => `Closing paragraph ${i}.`).join('\n\n')
    const { app, page } = await launchWithMarkdown(`# Diagram\n\n\`\`\`mermaid\ngraph TD\n${graph}\n\`\`\`\n\n${tail}\n`, {
      suppressErrorDialog: true,
      preferences: { tabBarVisibility: true, spellcheckerEnabled: false }
    })
    try {
      const scroller = page.locator('.editor-component')
      await expect(page.locator('.mu-container svg').first()).toBeVisible({ timeout: 15000 })
      await expect(page.locator('.mu-container')).not.toHaveClass(/mt-virtualized/)
      // The end of the document, below the diagram.
      const saved = await scroller.evaluate((el) => {
        el.scrollTop = el.scrollHeight
        el.dispatchEvent(new Event('scroll'))
        return el.scrollTop
      })
      expect(saved).toBeGreaterThan(500)
      await switchAwayAndBack(app, page, false)
      await expect.poll(() => scroller.evaluate((el) => el.scrollTop), { timeout: 10000 }).toBeCloseTo(saved, 0)
      await expectNoRendererErrors(app)
    } finally {
      await app.close()
    }
  })
})
