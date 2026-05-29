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

// `ensureWindowPosition` reads Electron's `screen` module. Drive it with a
// configurable set of fake displays. `bounds` and `workArea` are kept equal so
// the result is independent of the isLinux branch (which picks bounds vs
// workArea), except where a test sets a work area apart on purpose.
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

// A larger secondary monitor positioned to the right of the primary. bounds
// and workArea are kept equal so the expected result is the same on Linux
// (which clamps against bounds) and macOS/Windows (which use workArea).
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
    // Saved coordinates are present, yet the saved size exceeds the screen
    // (e.g. the display scale factor increased). Without clamping the window
    // opens larger than the screen and covers the taskbar. Regression for #2928.
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
    // Centered on the primary display; with the size clamped to the screen the
    // centered origin is the top-left corner.
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
    // Regression guard: the size must be clamped against the display that holds
    // the saved position, not the (smaller) primary display.
    state.primary = makePrimary()
    state.displays = [state.primary, makeSecondary()]

    const result = ensureWindowPosition({ x: 1200, y: 100, width: 1600, height: 1000 })
    expect(result.width).to.equal(1600)
    expect(result.height).to.equal(1000)
    expect(result.x).to.equal(1200)
    expect(result.y).to.equal(100)
  })

  it('clamps to the secondary display work area when the saved size exceeds it', () => {
    state.primary = makePrimary()
    state.displays = [state.primary, makeSecondary()]

    const result = ensureWindowPosition({ x: 1200, y: 100, width: 3000, height: 1600 })
    expect(result.width).to.equal(2560)
    expect(result.height).to.equal(1400)
    // Position is preserved (not re-centered).
    expect(result.x).to.equal(1200)
    expect(result.y).to.equal(100)
  })
})
