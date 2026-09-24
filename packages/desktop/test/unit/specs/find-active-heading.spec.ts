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
})
