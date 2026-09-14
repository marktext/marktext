import { describe, expect, it } from 'vitest'
import { getCssForOptions } from '@/util/pdf'

const baseOptions = {
  pageMarginTop: 15,
  pageMarginRight: 20,
  pageMarginBottom: 15,
  pageMarginLeft: 20
}

const hasHeadingBreakRule = (css: string): boolean =>
  /break-after\s*:\s*avoid/.test(css) && /h1\s*,\s*h2/.test(css)

describe('PDF/print heading page-break (#3039)', () => {
  it('emits a break-after:avoid rule for headings when printable (pdf)', async() => {
    const css = await getCssForOptions({ ...baseOptions, type: 'pdf' })
    expect(hasHeadingBreakRule(css)).toBe(true)
  })

  it('emits it for print too', async() => {
    const css = await getCssForOptions({ ...baseOptions, type: 'print' })
    expect(hasHeadingBreakRule(css)).toBe(true)
  })

  it('does not emit it for styledHtml export', async() => {
    const css = await getCssForOptions({ ...baseOptions, type: 'styledHtml' })
    expect(hasHeadingBreakRule(css)).toBe(false)
  })
})
