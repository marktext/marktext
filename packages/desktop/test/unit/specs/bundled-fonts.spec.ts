import { describe, expect, it } from 'vitest'
import {
  BUNDLED_MONOSPACE_FONTS,
  BUNDLED_PROPORTIONAL_FONTS,
  withBundledFonts
} from '@/prefComponents/common/fontTextBox/bundledFonts'

describe('withBundledFonts (#3021)', () => {
  it('prepends the bundled proportional font when the system list lacks it', () => {
    const result = withBundledFonts(['Arial', 'Times New Roman'], false)
    expect(result).toContain('Open Sans')
    expect(result.indexOf('Open Sans')).toBeLessThan(result.indexOf('Arial'))
  })

  it('prepends the bundled monospace font for the code-font picker', () => {
    const result = withBundledFonts(['Menlo', 'Consolas'], true)
    expect(result).toContain('DejaVu Sans Mono')
  })

  it('does not duplicate a bundled font already installed on the system', () => {
    const result = withBundledFonts(['Open Sans', 'Arial'], false)
    expect(result.filter(f => f === 'Open Sans')).toHaveLength(1)
  })

  it('exposes the bundled names so they stay in sync with @font-face', () => {
    expect(BUNDLED_PROPORTIONAL_FONTS).toContain('Open Sans')
    expect(BUNDLED_MONOSPACE_FONTS).toContain('DejaVu Sans Mono')
  })
})
