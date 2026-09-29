import { describe, it, expect } from 'vitest'
import {
  IDENTITY,
  MAX_SCALE,
  MIN_SCALE,
  fitScale,
  pan,
  zoomAt,
  type ZoomState
} from '@/util/zoomPan'

// Where a content point sits on screen, given the transform is
// `translate(x, y) scale(scale)` about the content's own centre and that centre
// starts at (cx, cy).
const projectX = (state: ZoomState, offset: number, cx: number): number =>
  cx + state.x + state.scale * offset

const projectY = (state: ZoomState, offset: number, cy: number): number =>
  cy + state.y + state.scale * offset

describe('zoomAt', () => {
  it('keeps the point under the cursor fixed', () => {
    const before: ZoomState = { scale: 1, x: 0, y: 0 }
    const cx = 400
    const cy = 300
    const px = 550
    const py = 380

    // The content offset that is under the cursor before the zoom.
    const ux = (px - cx - before.x) / before.scale
    const uy = (py - cy - before.y) / before.scale

    const after = zoomAt(before, 2, px, py, cx, cy)

    expect(projectX(after, ux, cx)).toBeCloseTo(px, 6)
    expect(projectY(after, uy, cy)).toBeCloseTo(py, 6)
  })

  it('keeps the point fixed when zooming out from an already panned state', () => {
    const before: ZoomState = { scale: 3, x: -120, y: 45 }
    const cx = 500
    const cy = 250
    const px = 610
    const py = 190

    const ux = (px - cx - before.x) / before.scale
    const uy = (py - cy - before.y) / before.scale
    const after = zoomAt(before, 0.5, px, py, cx, cy)

    expect(after.scale).toBeCloseTo(1.5, 6)
    expect(projectX(after, ux, cx)).toBeCloseTo(px, 6)
    expect(projectY(after, uy, cy)).toBeCloseTo(py, 6)
  })

  it('zooming about the centre leaves the translation alone', () => {
    const after = zoomAt({ scale: 1, x: 0, y: 0 }, 2, 400, 300, 400, 300)
    expect(after).toEqual({ scale: 2, x: 0, y: 0 })
  })

  it('clamps at the maximum scale', () => {
    const after = zoomAt({ scale: MAX_SCALE, x: 0, y: 0 }, 4, 10, 10, 0, 0)
    expect(after.scale).toBe(MAX_SCALE)
  })

  it('clamps at the minimum scale', () => {
    const after = zoomAt({ scale: MIN_SCALE, x: 0, y: 0 }, 0.25, 10, 10, 0, 0)
    expect(after.scale).toBe(MIN_SCALE)
  })

  it('does not move anything when the clamp swallows the zoom', () => {
    const before: ZoomState = { scale: MAX_SCALE, x: 30, y: -40 }
    expect(zoomAt(before, 2, 120, 90, 0, 0)).toEqual(before)
  })
})

describe('fitScale', () => {
  it('shrinks content that is wider than the viewport', () => {
    expect(fitScale({ width: 2000, height: 500 }, { width: 1000, height: 800 })).toBeCloseTo(0.5, 6)
  })

  it('shrinks content that is taller than the viewport', () => {
    expect(fitScale({ width: 400, height: 1600 }, { width: 1000, height: 800 })).toBeCloseTo(0.5, 6)
  })

  it('uses the tighter of the two axes', () => {
    expect(fitScale({ width: 2000, height: 3200 }, { width: 1000, height: 800 })).toBeCloseTo(0.25, 6)
  })

  it('never enlarges content that already fits', () => {
    expect(fitScale({ width: 100, height: 100 }, { width: 1000, height: 800 })).toBe(1)
  })

  it('never returns less than the minimum scale', () => {
    expect(fitScale({ width: 1e6, height: 1e6 }, { width: 10, height: 10 })).toBe(MIN_SCALE)
  })

  it('falls back to 1 for content with no measurable size', () => {
    expect(fitScale({ width: 0, height: 0 }, { width: 1000, height: 800 })).toBe(1)
  })
})

describe('pan', () => {
  it('adds the delta to the translation', () => {
    expect(pan({ scale: 2, x: 10, y: -5 }, 4, 6)).toEqual({ scale: 2, x: 14, y: 1 })
  })

  it('leaves the scale alone', () => {
    expect(pan({ scale: 2.5, x: 0, y: 0 }, 1, 1).scale).toBe(2.5)
  })
})

describe('IDENTITY', () => {
  it('is an untransformed state', () => {
    expect(IDENTITY).toEqual({ scale: 1, x: 0, y: 0 })
  })
})
