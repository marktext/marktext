import { expect, test } from '../fixtures/muya'

// #3840: a `&nbsp;` entity must behave as a real non-breaking space — the
// words on either side must never wrap apart. Regression: the html-escape
// span inherited `display: inline-block` from `.mu-hide`, making it an atomic
// box that the line could break around (so &nbsp; wrapped like a normal space).
async function lineCount(page, md: string): Promise<number> {
  await page.evaluate((m) => window.muya!.setContent(m), md)
  return page.evaluate(() => {
    const c = document.querySelector('.mu-content.mu-paragraph-content') as HTMLElement
    // Constrain width and disable overflow-based breaking so ONLY genuine
    // soft-wrap opportunities cause a wrap.
    c.style.maxWidth = '90px'
    c.style.display = 'block'
    c.style.overflowWrap = 'normal'
    c.style.wordBreak = 'normal'
    const lh = parseFloat(getComputedStyle(c).lineHeight) || 24
    return Math.round(c.getBoundingClientRect().height / lh)
  })
}

test('&nbsp; keeps the surrounding words on one line', async ({ page }) => {
  // sanity: a regular space IS a break opportunity → wraps to 2 lines
  expect(await lineCount(page, 'aaaaaa bbbbbb')).toBe(2)
  // the fix: &nbsp; must NOT break → both words stay on one (overflowing) line
  expect(await lineCount(page, 'aaaaaa&nbsp;bbbbbb')).toBe(1)
})

// Horizontal gap between the first and last 'x' glyph in the paragraph — i.e.
// the rendered width of whatever sits between them.
async function gapBetweenX(page, md: string): Promise<number> {
  await page.evaluate((m) => window.muya!.setContent(m), md)
  return page.evaluate(() => {
    const p = document.querySelector('.mu-paragraph') as HTMLElement
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT)
    const xs: { node: Text; idx: number }[] = []
    let n: Node | null
    while ((n = walker.nextNode())) {
      const t = n as Text
      const s = t.textContent || ''
      for (let i = 0; i < s.length; i++) if (s[i] === 'x') xs.push({ node: t, idx: i })
    }
    const rectOf = (e: { node: Text; idx: number }) => {
      const r = document.createRange()
      r.setStart(e.node, e.idx)
      r.setEnd(e.node, e.idx + 1)
      return r.getBoundingClientRect()
    }
    return Math.round(rectOf(xs[xs.length - 1]).left - rectOf(xs[0]).right)
  })
}

test('a &nbsp; renders the same width as a regular breaking space (#3840)', async ({ page }) => {
  // #3840 expects the gap to be "the same width as breaking spaces" — the
  // whitespace entity renders its glyph inline (the actual U+00A0) instead of
  // in the 1em glyph slot, so the gap equals a normal space rather than 1em.
  const spaceGap = await gapBetweenX(page, 'x x')
  const nbspGap = await gapBetweenX(page, 'x&nbsp;x')
  expect(nbspGap).toBe(spaceGap)
})

test('a visible entity renders at its character width, not a fixed 1em slot (#3840)', async ({ page }) => {
  // Every escape entity is exactly as wide as the character it stands for, so
  // `&amp;` is the width of a literal "&" rather than the old 1em glyph slot.
  const literalAmp = await gapBetweenX(page, 'x&x')
  const entityAmp = await gapBetweenX(page, 'x&amp;x')
  expect(entityAmp).toBe(literalAmp)
})
