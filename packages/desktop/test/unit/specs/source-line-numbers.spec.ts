import { describe, expect, it } from 'vitest'
import { makeLineNumberFormatter } from '@/util/sourceLineNumbers'

describe('makeLineNumberFormatter', () => {
  it('hides every label when frequency is 0', () => {
    const format = makeLineNumberFormatter(0)
    expect(format(1)).toBe('')
    expect(format(10)).toBe('')
    expect(format(37)).toBe('')
  })

  it('labels every line when frequency is 1', () => {
    const format = makeLineNumberFormatter(1)
    expect(format(1)).toBe(1)
    expect(format(2)).toBe(2)
    expect(format(99)).toBe(99)
  })

  it('labels every Nth line plus line 1 for frequency 5', () => {
    const format = makeLineNumberFormatter(5)
    expect(format(1)).toBe(1)
    expect(format(5)).toBe(5)
    expect(format(10)).toBe(10)
    expect(format(2)).toBe('')
    expect(format(7)).toBe('')
  })

  it.each([10, 20, 50])('labels multiples of %i and always line 1', (freq) => {
    const format = makeLineNumberFormatter(freq)
    expect(format(1)).toBe(1)
    expect(format(freq)).toBe(freq)
    expect(format(freq * 3)).toBe(freq * 3)
    expect(format(freq + 1)).toBe('')
    expect(format(freq - 1)).toBe('')
  })

  // Line 1 is always labelled even when it isn't a multiple of the frequency,
  // so the top of the document keeps a reference number.
  it('always labels line 1 regardless of frequency', () => {
    for (const freq of [5, 10, 20, 50]) {
      expect(makeLineNumberFormatter(freq)(1)).toBe(1)
    }
  })

  // Guard against a corrupted/negative preference value: treat it as "off"
  // rather than throwing or producing a modulo-by-negative surprise.
  it('hides every label for negative frequency', () => {
    const format = makeLineNumberFormatter(-5)
    expect(format(1)).toBe('')
    expect(format(10)).toBe('')
  })
})
