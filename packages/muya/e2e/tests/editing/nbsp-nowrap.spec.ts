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

test('a hidden &nbsp; entity adds no extra width (literal marker is out of flow)', async ({ page }) => {
  // When the caret is not inside the entity (`.mu-hide`), the literal `&nbsp;`
  // text is taken out of flow, so the entity occupies only its glyph margin
  // rather than the full width of the 6 transparent literal characters.
  const boxWidth = await page.evaluate(() => {
    window.muya!.setContent('a&nbsp;b')
    const esc = document.querySelector('.mu-html-escape') as HTMLElement
    return Math.round(esc.getBoundingClientRect().width)
  })
  expect(boxWidth).toBe(0)
})
