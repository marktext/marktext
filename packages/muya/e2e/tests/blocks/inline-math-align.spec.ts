import { expect, test } from '../fixtures/muya'

// #4339 follow-up: the popup's `overflow: auto hidden` (for horizontal scroll)
// also applied to the hidden inline render, making its inline-block baseline its
// bottom edge — so a hidden inline math / parse-error sat a few px above the
// surrounding text. `overflow: visible` when hidden keeps it on the baseline.
async function renderVsTextTop(page, md: string): Promise<number> {
  await page.evaluate((m) => window.muya!.setContent(m), md)
  await page.waitForTimeout(150)
  return page.evaluate(() => {
    const render = document.querySelector('.mu-math > .mu-math-render') as HTMLElement
    const p = document.querySelector('.mu-paragraph') as HTMLElement
    const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT)
    let n: Node | null; let h: DOMRect | null = null
    while ((n = w.nextNode())) {
      const t = n as Text; const i = (t.textContent || '').indexOf('h')
      if (i >= 0) { const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 1); h = r.getBoundingClientRect(); break }
    }
    return Math.round(render.getBoundingClientRect().top) - Math.round(h!.top)
  })
}

test('a hidden inline math sits on the surrounding text baseline, not above it', async ({ page }) => {
  expect(Math.abs(await renderVsTextTop(page, 'hello $x^2$ www'))).toBeLessThanOrEqual(3)
})

test('a hidden inline-math parse error sits on the surrounding text baseline', async ({ page }) => {
  expect(Math.abs(await renderVsTextTop(page, 'hello $\\invalidcmd$ www'))).toBeLessThanOrEqual(3)
})
