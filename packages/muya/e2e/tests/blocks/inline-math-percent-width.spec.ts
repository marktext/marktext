import { expect, test } from '../fixtures/muya'

// The desktop app's "Editor--Max width" preference can be a percentage (e.g.
// `100%`), which it applies via `--editor-area-width: calc(100px + <value>)`.
// `.mu-math > .mu-math-render` is `position: absolute` inside `.mu-math` (a
// small, shrink-to-fit inline box sized to the raw formula text), so reading
// that `%`-bearing custom property directly in a `calc()` on the popup used to
// resolve the `%` against `.mu-math`'s tiny box instead of the editor column,
// squeezing the popup down to a few px. `.mu-container` is a `cqw` query
// container so the popup can size itself off the real column width instead.
test('inline-math popup keeps the editor-column width when the max-width preference is a percentage', async ({ page }) => {
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--editor-area-width', 'calc(100px + 60%)')
    window.muya!.setContent('text $x^2+y^2=z^2$ end')
  })
  await page.waitForTimeout(150)

  const { containerWidth, mathWidth, renderMaxWidth } = await page.evaluate(() => {
    const container = document.querySelector('.mu-container') as HTMLElement
    const math = document.querySelector('.mu-math') as HTMLElement
    const render = document.querySelector('.mu-math > .mu-math-render') as HTMLElement
    return {
      containerWidth: container.getBoundingClientRect().width,
      mathWidth: math.getBoundingClientRect().width,
      renderMaxWidth: Number.parseFloat(getComputedStyle(render).maxWidth),
    }
  })

  // Anchored to the editor column (matches `.mu-container`'s width minus its
  // 100px horizontal padding), not squeezed down to `.mu-math`'s own width.
  expect(renderMaxWidth).toBeGreaterThan(mathWidth * 3)
  expect(Math.abs(renderMaxWidth - (containerWidth - 100))).toBeLessThanOrEqual(2)
})
