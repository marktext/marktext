import { describe, it, expect } from 'vitest'
import { findActiveHeadingSlug, type HeadingPosition } from '@/util/findActiveHeading'

describe('findActiveHeadingSlug', () => {
  const headings: HeadingPosition[] = [
    { slug: 'intro', top: 0 },
    { slug: 'setup', top: 200 },
    { slug: 'usage', top: 500 },
    { slug: 'advanced', top: 900 }
  ]

  it('returns null for an empty headings array', () => {
    expect(findActiveHeadingSlug([], 100)).toBeNull()
  })

  it('returns null when cursor is above all headings', () => {
    const raised: HeadingPosition[] = [
      { slug: 'first', top: 100 },
      { slug: 'second', top: 300 }
    ]
    expect(findActiveHeadingSlug(raised, 50)).toBeNull()
  })

  it('returns the first heading when cursor is exactly at its top', () => {
    expect(findActiveHeadingSlug(headings, 0)).toBe('intro')
  })

  it('returns the heading when cursor is between two headings', () => {
    expect(findActiveHeadingSlug(headings, 350)).toBe('setup')
  })

  it('returns the last heading when cursor is below all headings', () => {
    expect(findActiveHeadingSlug(headings, 1200)).toBe('advanced')
  })

  it('returns the heading whose top equals cursorTop exactly', () => {
    expect(findActiveHeadingSlug(headings, 500)).toBe('usage')
  })

  it('works with a single heading', () => {
    const single: HeadingPosition[] = [{ slug: 'only', top: 50 }]
    expect(findActiveHeadingSlug(single, 100)).toBe('only')
    expect(findActiveHeadingSlug(single, 50)).toBe('only')
    expect(findActiveHeadingSlug(single, 10)).toBeNull()
  })

  it('keeps fractional positions and chooses the last heading at the same top', () => {
    const headings: HeadingPosition[] = [
      { slug: 'first', top: 50.25 },
      { slug: 'second', top: 50.25 },
      { slug: 'third', top: 50.75 }
    ]
    expect(findActiveHeadingSlug(headings, 50.24)).toBeNull()
    expect(findActiveHeadingSlug(headings, 50.25)).toBe('second')
    expect(findActiveHeadingSlug(headings, 50.74)).toBe('second')
  })

  it('skips hidden headings at every position', () => {
    const tops = [100, 200, 300, 400, 500]
    for (let mask = 0; mask < 2 ** tops.length; mask++) {
      const headings = tops.map((top, index) => ({
        slug: `heading-${index}`,
        top: mask & (1 << index) ? null : top
      }))
      for (const cursorTop of [0, 100, 250, 300, 550]) {
        const expected = headings
          .filter((heading) => heading.top !== null && heading.top <= cursorTop)
          .at(-1)
        expect(findActiveHeadingSlug(headings, cursorTop)).toBe(expected?.slug ?? null)
      }
    }
  })

  it.each([103, 511])('reads at most log2(n) live positions for %i headings', (count) => {
    const reads = new Set<number>()
    let offset = 0
    const headings = Array.from({ length: count }, (_, index) => ({
      slug: `heading-${index}`,
      get top() {
        expect(reads.has(index)).toBe(false)
        reads.add(index)
        return index * 100 + offset
      }
    }))
    for (const cursorTop of [-1, 0, 100, 250, (count - 1) * 100, count * 100]) {
      reads.clear()
      const active = Math.min(count - 1, Math.floor(cursorTop / 100))
      expect(findActiveHeadingSlug(headings, cursorTop)).toBe(
        active < 0 ? null : `heading-${active}`
      )
      expect(reads.size).toBeLessThanOrEqual(Math.ceil(Math.log2(count + 1)))
    }
    offset = 1000
    reads.clear()
    expect(findActiveHeadingSlug(headings, 1250)).toBe('heading-2')
  })

  it('never reads a hidden heading more than once per search', () => {
    const reads = new Set<number>()
    const headings = Array.from({ length: 511 }, (_, index) => ({
      slug: `heading-${index}`,
      get top() {
        expect(reads.has(index)).toBe(false)
        reads.add(index)
        return index % 100 === 0 ? index * 100 : null
      }
    }))
    expect(findActiveHeadingSlug(headings, 25000)).toBe('heading-200')
  })
})
