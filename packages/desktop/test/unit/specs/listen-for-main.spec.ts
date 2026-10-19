import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// `listenForMain` pulls in the layout store, which transitively imports the
// preferences store and `@/config` (the latter reads `window.path.sep` at
// module load). Stub the contextBridge surfaces before the hoisted imports run
// so the store graph can load.
vi.hoisted(() => {
  const w = globalThis as unknown as { window?: { path?: { sep: string } } }
  w.window ??= {}
  w.window.path ??= { sep: '/' }
})

import { useListenForMainStore } from '@/store/listenForMain'
import { useLayoutStore } from '@/store/layout'

// `EDITOR_EDIT_ACTION('findInFolder')` routes through `layoutStore.SET_LAYOUT`,
// which (because `showSideBar` is defined) reads `window.marktext.env`,
// fires `window.electron.ipcRenderer.send`, and persists the sidebar
// visibility preference (another `ipcRenderer.send`). The renderer i18n module
// (pulled in via the preferences store) also reads `window.electron.ipcRenderer`
// at import time. Provide spies for all of it.
const win = window as unknown as {
  electron?: { ipcRenderer: { on: Mock; send: Mock; invoke: Mock } }
  marktext?: { env: { windowId: number } }
}

describe('listenForMain store EDITOR_EDIT_ACTION', () => {
  beforeEach(() => {
    win.electron = {
      ipcRenderer: {
        on: vi.fn(),
        send: vi.fn(),
        invoke: vi.fn(() => Promise.resolve(false))
      }
    }
    win.marktext = { env: { windowId: 1 } }
    setActivePinia(createPinia())
  })

  afterEach(() => {
    delete win.electron
    delete win.marktext
    vi.clearAllMocks()
  })

  it("opens the search side panel for 'findInFolder'", () => {
    const layoutStore = useLayoutStore()
    expect(layoutStore.rightColumn).toBe('files')
    expect(layoutStore.showSideBar).toBe(false)

    useListenForMainStore().EDITOR_EDIT_ACTION('findInFolder')

    expect(layoutStore.rightColumn).toBe('search')
    expect(layoutStore.showSideBar).toBe(true)
  })

  it('does not mutate the layout for a non-findInFolder action', () => {
    const layoutStore = useLayoutStore()
    layoutStore.$patch({ rightColumn: 'files', showSideBar: false })

    useListenForMainStore().EDITOR_EDIT_ACTION('insertParagraph')

    expect(layoutStore.rightColumn).toBe('files')
    expect(layoutStore.showSideBar).toBe(false)
  })

  it.each(['', 'toc', 'unknown'])('restores legacy sidebar page %j as files', (rightColumn) => {
    const layoutStore = useLayoutStore()
    layoutStore.RESTORE_BUFFERED_STATE({
      rightColumn,
      showSideBar: true,
      showTabBar: true,
      sideBarWidth: 320
    })
    expect(layoutStore.rightColumn).toBe('files')
    expect(layoutStore.effectiveSideBarWidth).toBe(320)
    layoutStore.TOGGLE_LAYOUT_ENTRY('showSideBar')
    expect(layoutStore.effectiveSideBarWidth).toBe(0)
    layoutStore.TOGGLE_LAYOUT_ENTRY('showSideBar')
    expect(layoutStore.effectiveSideBarWidth).toBe(320)
  })

  it('repeated search layout requests keep the search page expanded', () => {
    const layoutStore = useLayoutStore()
    layoutStore.LISTEN_FOR_LAYOUT()
    const listener = win.electron?.ipcRenderer.on.mock.calls.find(
      ([channel]) => channel === 'mt::set-view-layout'
    )?.[1]
    if (!listener) throw new Error('Layout listener was not registered')
    listener({}, { rightColumn: 'search' })
    listener({}, { rightColumn: 'search' })
    expect(layoutStore.rightColumn).toBe('search')
    expect(layoutStore.showSideBar).toBe(true)
    expect(layoutStore.effectiveSideBarWidth).toBeGreaterThanOrEqual(220)
  })

})
