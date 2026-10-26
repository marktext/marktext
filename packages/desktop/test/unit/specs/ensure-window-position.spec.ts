import { describe, it, expect, vi, beforeEach } from 'vitest'

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

interface FakeDisplay {
  bounds: Rect
  workArea: Rect
}

const state = vi.hoisted(() => {
  const primary: FakeDisplay = {
    bounds: { x: 0, y: 0, width: 1138, height: 640 },
    workArea: { x: 0, y: 0, width: 1138, height: 640 }
  }
  return { displays: [primary] as FakeDisplay[], primary }
})

vi.mock('electron', () => ({
  screen: {
    getPrimaryDisplay: () => state.primary,
    getAllDisplays: () => state.displays
  }
}))

import { ensureWindowPosition } from 'main_renderer/windows/utils'

const makePrimary = (): FakeDisplay => ({
  bounds: { x: 0, y: 0, width: 1138, height: 640 },
  workArea: { x: 0, y: 0, width: 1138, height: 640 }
})

const makeSecondary = (): FakeDisplay => ({
  bounds: { x: 1138, y: 0, width: 2560, height: 1400 },
  workArea: { x: 1138, y: 0, width: 2560, height: 1400 }
})

beforeEach(() => {
  const primary = makePrimary()
  state.primary = primary
  state.displays = [primary]
})

describe('ensureWindowPosition', () => {
  it('clamps a restored size larger than the screen for a returning user', () => {
    const result = ensureWindowPosition({ x: 0, y: 0, width: 1200, height: 800 })
    expect(result.width).to.equal(1138)
    expect(result.height).to.equal(640)
    expect(result.x).to.equal(0)
    expect(result.y).to.equal(0)
  })

  it('clamps an oversized size on first start (no saved coordinates)', () => {
    const result = ensureWindowPosition({ width: 1200, height: 800 })
    expect(result.width).to.equal(1138)
    expect(result.height).to.equal(640)
    expect(result.x).to.equal(0)
    expect(result.y).to.equal(0)
  })

  it('leaves a size that already fits the screen untouched', () => {
    const result = ensureWindowPosition({ x: 100, y: 80, width: 900, height: 500 })
    expect(result.width).to.equal(900)
    expect(result.height).to.equal(500)
    expect(result.x).to.equal(100)
    expect(result.y).to.equal(80)
  })

  it('centers a window whose saved position is off every display', () => {
    const result = ensureWindowPosition({ x: 9000, y: 9000, width: 800, height: 600 })
    expect(result.width).to.equal(800)
    expect(result.height).to.equal(600)
    expect(result.x).to.equal(Math.ceil((1138 - 800) / 2))
    expect(result.y).to.equal(Math.ceil((640 - 600) / 2))
  })

  it('does not shrink a window restored on a larger secondary display', () => {
    state.primary = makePrimary()
    state.displays = [state.primary, makeSecondary()]

    const result = ensureWindowPosition({ x: 1200, y: 100, width: 1600, height: 1000 })
    expect(result.width).to.equal(1600)
    expect(result.height).to.equal(1000)
    expect(result.x).to.equal(1200)
    expect(result.y).to.equal(100)
  })

  it('clamps size and position to the secondary display when the saved size exceeds it', () => {
    state.primary = makePrimary()
    state.displays = [state.primary, makeSecondary()]

    const result = ensureWindowPosition({ x: 1200, y: 100, width: 3000, height: 1600 })
    expect(result.width).to.equal(2560)
    expect(result.height).to.equal(1400)
    expect(result.x).to.equal(1138)
    expect(result.y).to.equal(0)
  })

  it('nudges a window back on-screen when the saved position would overflow', () => {
    const result = ensureWindowPosition({ x: 1000, y: 560, width: 400, height: 300 })
    expect(result.width).to.equal(400)
    expect(result.height).to.equal(300)
    expect(result.x).to.equal(1138 - 400)
    expect(result.y).to.equal(640 - 300)
  })

  it('selects the display by half-open bounds at a shared edge', () => {
    state.primary = makePrimary()
    state.displays = [state.primary, makeSecondary()]

    const result = ensureWindowPosition({ x: 1138, y: 0, width: 2000, height: 500 })
    expect(result.width).to.equal(2000)
    expect(result.x).to.equal(1138)
  })
})
