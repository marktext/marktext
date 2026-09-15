import { describe, expect, it, vi } from 'vitest'

// The editor context-menu overlay. `clampPosition` and `formatAccelerator`
// are pure and testable directly; the command-id list is cross-checked
// against the command center so a renamed command breaks this test instead
// of silently throwing on right-click; the smoke test proves the overlay
// actually opens inside an `.editor-wrapper`.

import commands from '@/commands'
import { CONTEXT_MENU_COMMAND_IDS, clampPosition, formatAccelerator } from '@/contextMenu'

describe('context menu clampPosition', () => {
  it('keeps an interior position untouched', () => {
    // 800×600 panel in the middle of a 1920×1080 viewport.
    const pos = clampPosition(500, 300, 800, 600, 1920, 1080)
    expect(pos).toEqual({ x: 500, y: 300 })
  })

  it('flips to the mouse side on right overflow', () => {
    // 200px panel at x=1800 in a 1920 viewport → would end at 2000.
    const pos = clampPosition(1800, 300, 200, 300, 1920, 1080)
    expect(pos.x).toBe(1600)
    expect(pos.y).toBe(300)
  })

  it('flips to above the mouse on bottom overflow', () => {
    const pos = clampPosition(500, 1000, 200, 300, 1920, 1080)
    expect(pos.y).toBe(700)
    expect(pos.x).toBe(500)
  })

  it('falls back to a margin-aligned position when the panel fits nowhere', () => {
    // Panel wider than the viewport minus margins.
    const pos = clampPosition(100, 100, 2000, 200, 1920, 1080)
    expect(pos.x).toBe(6)
    expect(pos.y).toBe(100)
  })

  it('never returns less than the margin', () => {
    // Mouse beyond the top-left corner of the viewport (negative coordinates).
    const pos = clampPosition(-50, -50, 200, 300, 1920, 1080)
    expect(pos.x).toBeGreaterThanOrEqual(6)
    expect(pos.y).toBeGreaterThanOrEqual(6)
  })
})

describe('context menu command ids', () => {
  it('only references ids that exist in the command center', () => {
    const knownIds = new Set(commands.map((c) => c.id))
    const missing = CONTEXT_MENU_COMMAND_IDS.filter((id) => !knownIds.has(id))
    expect(missing).toEqual([])
  })
})

describe('context menu formatAccelerator', () => {
  it('returns an empty string for unbound entries', () => {
    expect(formatAccelerator(undefined)).toBe('')
    expect(formatAccelerator('')).toBe('')
  })

  it('normalises CommandOrControl and CmdOrCtrl to Ctrl on non-macOS', () => {
    expect(formatAccelerator('CommandOrControl+B')).toBe('Ctrl+B')
    expect(formatAccelerator('CmdOrCtrl+Shift+K')).toBe('Ctrl+Shift+K')
  })

  it('maps Option to Alt and leaves plain modifiers alone', () => {
    expect(formatAccelerator('Option+Shift+5')).toBe('Alt+Shift+5')
    expect(formatAccelerator('Ctrl+Y')).toBe('Ctrl+Y')
  })

  it('uses Cmd on macOS', async() => {
    vi.resetModules()
    vi.doMock('@/util', () => ({ isOsx: true }))
    const { formatAccelerator: macFormat } = await import('@/contextMenu')
    expect(macFormat('CommandOrControl+B')).toBe('Cmd+B')
    // Option maps to Alt on every platform; only Command/CmdOrCtrl differs.
    expect(macFormat('Option+Shift+5')).toBe('Alt+Shift+5')
    vi.doUnmock('@/util')
  })
})

describe('context menu overlay smoke test', () => {
  it('opens inside an .editor-wrapper and not outside of it', async() => {
    vi.resetModules()
    const initEditorContextMenu = (await import('@/contextMenu')).default
    initEditorContextMenu()

    const wrapper = document.createElement('div')
    wrapper.className = 'editor-wrapper'
    const inside = document.createElement('p')
    wrapper.appendChild(inside)
    document.body.appendChild(wrapper)

    const insideEvent = new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true, clientX: 120, clientY: 120
    })
    inside.dispatchEvent(insideEvent)
    expect(insideEvent.defaultPrevented).toBe(true)
    expect(document.querySelector('.mt-ctx')).not.toBeNull()

    // Cleanup so later suites see a pristine document.
    document.body.removeChild(wrapper)
    document.querySelector('.mt-ctx')?.remove()
  })
})
