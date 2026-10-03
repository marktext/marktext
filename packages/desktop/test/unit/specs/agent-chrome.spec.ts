import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import keybindingsDarwin from 'main_renderer/keyboard/keybindingsDarwin'
import keybindingsLinux from 'main_renderer/keyboard/keybindingsLinux'
import keybindingsWindows from 'main_renderer/keyboard/keybindingsWindows'

vi.hoisted(() => {
  const w = globalThis as unknown as { window?: { path?: { sep: string } } }
  w.window ??= {}
  w.window.path ??= { sep: '/' }
})

import {
  AGENT_RAIL_WIDTH,
  EDITOR_PANE_MIN,
  TEXT_COLUMN_MIN,
  fitAgentPanel
} from '@/agent/chrome/fit'
import { useAgentStore } from '@/store/agent'
import { useLayoutStore } from '@/store/layout'

const win = window as unknown as {
  electron?: { ipcRenderer: { on: Mock; send: Mock; invoke: Mock } }
  marktext?: { env: { windowId: number } }
}

const AGENT_SHORTCUTS: Array<[string, string, string]> = [
  ['view.toggle-agent-panel', 'Ctrl+\\', 'Command+\\'],
  ['view.toggle-terminal', 'Ctrl+Alt+\\', 'Command+Option+\\'],
  ['comments.comment', 'Ctrl+Alt+C', 'Command+Option+G'],
  ['comments.send-selected', 'Ctrl+Shift+Enter', 'Command+Shift+Enter'],
  ['comments.send-all', 'Ctrl+Alt+Enter', 'Command+Option+Enter'],
  ['comments.next-thread', 'Alt+Down', 'Option+Down'],
  ['comments.previous-thread', 'Alt+Up', 'Option+Up']
]

describe('fitAgentPanel', () => {
  it('keeps the text column at 1366 by collapsing the agent panel to a rail', () => {
    const fit = fitAgentPanel({
      windowWidth: 1366,
      sideBarWidth: 280,
      requestedWidth: 320,
      shown: true
    })

    expect(fit.rail).toBe(true)
    expect(fit.width).toBe(AGENT_RAIL_WIDTH)
    expect(fit.editorWidth).toBeGreaterThanOrEqual(EDITOR_PANE_MIN)
    expect(fit.editorWidth).toBeGreaterThanOrEqual(TEXT_COLUMN_MIN)
  })

  it('keeps a 320 px panel when the window has room', () => {
    const fit = fitAgentPanel({
      windowWidth: 1600,
      sideBarWidth: 280,
      requestedWidth: 320,
      shown: true
    })

    expect(fit.rail).toBe(false)
    expect(fit.width).toBe(320)
    expect(fit.editorWidth).toBe(1000)
  })

  it('drops the panel width when the panel is hidden', () => {
    const fit = fitAgentPanel({
      windowWidth: 1366,
      sideBarWidth: 280,
      requestedWidth: 320,
      shown: false
    })

    expect(fit.width).toBe(0)
    expect(fit.editorWidth).toBe(1086)
  })
})

describe('agent layout buffer', () => {
  beforeEach(() => {
    win.electron = {
      ipcRenderer: {
        on: vi.fn(),
        send: vi.fn(),
        invoke: vi.fn(() => Promise.resolve(false))
      }
    }
    win.marktext = { env: { windowId: 1 } }
    localStorage.removeItem('agent-panel-width')
    localStorage.removeItem('terminal-panel-height')
    setActivePinia(createPinia())
  })

  afterEach(() => {
    delete win.electron
    delete win.marktext
    vi.clearAllMocks()
  })

  it('restores panel sizes and visibility from the window buffer', () => {
    const layout = useLayoutStore()
    layout.SET_AGENT_PANEL_WIDTH(360, { scheduleBufferUpdate: false })
    layout.SET_TERMINAL_PANEL_HEIGHT(180, { scheduleBufferUpdate: false })
    layout.SET_LAYOUT(
      {
        showAgentPanel: false,
        agentPanelTab: 'chat',
        showTerminalPanel: true
      },
      { scheduleBufferUpdate: false }
    )

    const saved = layout.CREATE_BUFFERED_STATE()
    layout.SET_AGENT_PANEL_WIDTH(320, { scheduleBufferUpdate: false })
    layout.SET_TERMINAL_PANEL_HEIGHT(220, { scheduleBufferUpdate: false })
    layout.SET_LAYOUT(
      {
        showAgentPanel: true,
        agentPanelTab: 'comments',
        showTerminalPanel: false
      },
      { scheduleBufferUpdate: false }
    )

    layout.RESTORE_BUFFERED_STATE(saved)

    expect(layout.agentPanelWidth).toBe(360)
    expect(layout.terminalPanelHeight).toBe(180)
    expect(layout.showAgentPanel).toBe(false)
    expect(layout.agentPanelTab).toBe('chat')
    expect(layout.showTerminalPanel).toBe(true)
    expect(localStorage.getItem('agent-panel-width')).toBe('360')
    expect(localStorage.getItem('terminal-panel-height')).toBe('180')
  })

  it('ignores agent panel toggles until the agent is available', () => {
    const layout = useLayoutStore()
    expect(layout.showAgentPanel).toBe(true)

    layout.TOGGLE_LAYOUT_ENTRY('showAgentPanel')
    expect(layout.showAgentPanel).toBe(true)

    useAgentStore().repoState = { kind: 'repo', root: '/repo', userName: 'Ada' }
    layout.TOGGLE_LAYOUT_ENTRY('showAgentPanel')
    expect(layout.showAgentPanel).toBe(false)
  })
})

describe('agent keybindings', () => {
  it('registers the seven commands on each platform without sharing an accelerator', () => {
    const maps = [
      { name: 'linux', map: keybindingsLinux, column: 1 },
      { name: 'windows', map: keybindingsWindows, column: 1 },
      { name: 'darwin', map: keybindingsDarwin, column: 2 }
    ] as const

    for (const { name, map, column } of maps) {
      for (const row of AGENT_SHORTCUTS) {
        const accelerator = row[column]
        expect(map.get(row[0]), `${name} ${row[0]}`).toBe(accelerator)
        for (const [id, existing] of map) {
          if (id !== row[0]) {
            expect(existing, `${name} ${row[0]} clashes with ${id}`).not.toBe(accelerator)
          }
        }
      }
    }
  })
})
