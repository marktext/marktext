import { describe, it, expect } from 'vitest'
import { computeRevealScrollTop, isRowFullyVisible } from '@/util/revealTreeRow'

const base = { rowHeight: 30, viewportHeight: 300, scrollHeight: 1000 }

describe('isRowFullyVisible', () => {
  it('treats a row flush with either viewport edge as visible', () => {
    expect(isRowFullyVisible({ ...base, rowTopInContent: 100, scrollTop: 100 })).toBe(true)
    expect(
      isRowFullyVisible({
        ...base,
        rowTopInContent: 370,
        rowHeight: 30,
        viewportHeight: 300,
        scrollTop: 100
      })
    ).toBe(true)
  })

  it('reports rows clipped by an edge as not visible', () => {
    expect(isRowFullyVisible({ ...base, rowTopInContent: 99, scrollTop: 100 })).toBe(false)
    expect(isRowFullyVisible({ ...base, rowTopInContent: 371, scrollTop: 100 })).toBe(false)
  })
})

describe('computeRevealScrollTop', () => {
  it('leaves an already visible row alone', () => {
    expect(computeRevealScrollTop({ ...base, rowTopInContent: 120, scrollTop: 100 })).toBe(null)
  })

  it('centres a row below the viewport', () => {
    // 500 - (300 - 30) / 2 = 365, which puts the row at y=135 — dead centre.
    expect(computeRevealScrollTop({ ...base, rowTopInContent: 500, scrollTop: 0 })).toBe(365)
  })

  it('centres a row above the viewport', () => {
    expect(computeRevealScrollTop({ ...base, rowTopInContent: 200, scrollTop: 500 })).toBe(65)
  })

  it('clamps at both ends of the scrollable content', () => {
    expect(computeRevealScrollTop({ ...base, rowTopInContent: 10, scrollTop: 500 })).toBe(0)
    expect(computeRevealScrollTop({ ...base, rowTopInContent: 990, scrollTop: 0 })).toBe(700)
  })

  it('honours the relativeTop alignment used by reveal()', () => {
    expect(computeRevealScrollTop({ ...base, rowTopInContent: 500, scrollTop: 0, relativeTop: 0 })).toBe(500)
    // relativeTop 1 pins the row's bottom to the viewport bottom: 500 + 30 - 300.
    expect(computeRevealScrollTop({ ...base, rowTopInContent: 500, scrollTop: 0, relativeTop: 1 })).toBe(230)
  })

  it('does nothing while the view has no height', () => {
    expect(
      computeRevealScrollTop({ ...base, rowTopInContent: 500, scrollTop: 0, viewportHeight: 0 })
    ).toBe(null)
  })

  it('still positions a row taller than the viewport', () => {
    expect(
      computeRevealScrollTop({
        rowTopInContent: 500,
        rowHeight: 400,
        viewportHeight: 300,
        scrollHeight: 1000,
        scrollTop: 0
      })
    ).toBe(550)
  })
})
