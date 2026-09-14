import { expect, test } from '../fixtures/muya'

// #4339: a long inline math must stay scrollable (not truncated) when hidden,
// and the popup/inline scrollbar is thinned. The parse-error message is short
// and never scrolls, so it keeps `overflow: visible` to stay on the text
// baseline (the popup's `overflow: auto` otherwise takes the inline-block's
// baseline from its bottom edge, pushing the message a few px above the text).
// (A long valid formula keeps `overflow: auto` to stay scrollable, which is the
// chosen trade-off — it sits slightly high rather than being truncated.)

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

test('a hidden inline-math parse error sits on the surrounding text baseline', async ({ page }) => {
  expect(Math.abs(await renderVsTextTop(page, 'hello $\\invalidcmd$ www'))).toBeLessThanOrEqual(3)
})

test('a long hidden inline math stays scrollable, not truncated', async ({ page }) => {
  const longMath = `$${Array.from({ length: 40 }, (_, i) => `x_{${i}}`).join('+')}$`
  await page.evaluate((m) => window.muya!.setContent(`text ${m} end`), longMath)
  await page.waitForTimeout(250)
  const r = await page.evaluate(() => {
    const render = document.querySelector('.mu-math > .mu-math-render') as HTMLElement
    return {
      hidden: render.closest('.mu-math')!.classList.contains('mu-hide'),
      overflowX: getComputedStyle(render).overflowX,
      scrollable: render.scrollWidth > render.clientWidth + 2,
    }
  })
  expect(r.hidden).toBe(true)
  expect(r.overflowX).toBe('auto')
  expect(r.scrollable).toBe(true) // content is reachable by scrolling, not cut off
})

test('a short inline math ending in a subscript shows no scrollbar (#4837)', async ({ page }) => {
  // KaTeX gives every sub/superscript a 2px `.vlist-s` strut that its
  // `.vlist-t2` margin cancels visually but not in scrollWidth; the popup's
  // `overflow: auto` then drew a spurious scrollbar under any short formula
  // ending in one. The rendered scroll extent must match the visible width.
  await page.evaluate(() => window.muya!.setContent('inline $x_1$ here'))
  await page.waitForTimeout(150)
  const r = await page.evaluate(() => {
    const render = document.querySelector('.mu-math > .mu-math-render') as HTMLElement
    return {
      hidden: render.closest('.mu-math')!.classList.contains('mu-hide'),
      overflowX: render.scrollWidth - render.clientWidth,
    }
  })
  expect(r.hidden).toBe(true)
  expect(r.overflowX).toBe(0) // no horizontal overflow, so no scrollbar
})

test('the inline-math scrollbar is thin (6px, matching code blocks)', async ({ page }) => {
  await page.evaluate(() => window.muya!.setContent('x'))
  await page.waitForTimeout(100)
  // The ::-webkit-scrollbar height rule is what thins the bar; assert it is wired.
  const height = await page.evaluate(() => {
    const sheets = [...document.styleSheets]
    for (const s of sheets) {
      let rules: CSSRuleList
      try { rules = s.cssRules } catch { continue }
      for (const rule of rules) {
        if (rule instanceof CSSStyleRule && rule.selectorText?.includes('.mu-math > .mu-math-render::-webkit-scrollbar')) {
          return rule.style.height
        }
      }
    }
    return ''
  })
  expect(height).toBe('6px')
})
