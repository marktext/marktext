import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import bus from '../bus'
import { usePreferencesStore } from './preferences'
import { debouncedSendBufferedState } from './bufferedState'

interface LayoutPartial {
  rightColumn?: string
  secondaryColumn?: string
  showSideBar?: boolean
  showSecondarySideBar?: boolean
  showTabBar?: boolean
  sideBarWidth?: number | string
  secondarySideBarWidth?: number | string
}

interface SetLayoutOptions {
  scheduleBufferUpdate?: boolean
}

// Boolean layout entries that can be toggled from the View menu / command palette.
type LayoutToggleEntry = 'showSideBar' | 'showTabBar'

const normalizeSideBarWidth = (width: unknown): number => {
  const numericWidth = Number(width)
  return Number.isFinite(numericWidth) ? Math.max(numericWidth, 220) : 280
}

interface BufferedLayout {
  rightColumn: string | undefined
  secondaryColumn: string | undefined
  showSideBar: boolean
  showSecondarySideBar: boolean
  showTabBar: boolean
  sideBarWidth: number
  secondarySideBarWidth: number
}

const createBufferedLayoutState = (state: unknown): BufferedLayout | null => {
  if (!state || typeof state !== 'object') return null
  const s = state as LayoutPartial

  // Pass through `rightColumn` / `secondaryColumn` (may be undefined); the
  // pre-migration JS did not coerce them here — RESTORE_BUFFERED_STATE routes
  // through SET_LAYOUT which only assigns defined keys.
  return {
    rightColumn: s.rightColumn,
    secondaryColumn: s.secondaryColumn,
    showSideBar: !!s.showSideBar,
    showSecondarySideBar: !!s.showSecondarySideBar,
    showTabBar: !!s.showTabBar,
    sideBarWidth: normalizeSideBarWidth(s.sideBarWidth),
    secondarySideBarWidth: normalizeSideBarWidth(s.secondarySideBarWidth)
  }
}

const initialWidth = localStorage.getItem('side-bar-width')
const initialSideBarWidth = normalizeSideBarWidth(initialWidth)
const initialSecondaryWidth = localStorage.getItem('secondary-side-bar-width')
const initialSecondarySideBarWidth = normalizeSideBarWidth(initialSecondaryWidth)

export const useLayoutStore = defineStore('layout', () => {
  // Primary (left) sidebar.
  const rightColumn = ref<string>('files')
  const showSideBar = ref(false)
  const sideBarWidth = ref<number>(initialSideBarWidth)

  // Secondary (right) sidebar — content chosen from the View menu (no icon strip).
  const secondaryColumn = ref<string>('toc')
  const showSecondarySideBar = ref(false)
  const secondarySideBarWidth = ref<number>(initialSecondarySideBarWidth)

  const showTabBar = ref(false)

  // Rendered width of the primary sidebar: 0 when hidden, 45px icon strip when
  // no view is active, else the resizable view width.
  const effectiveSideBarWidth = computed<number>(() => {
    if (!showSideBar.value) return 0
    if (!rightColumn.value) return 45
    return Number(sideBarWidth.value)
  })

  const layoutEntryValue = (name: LayoutToggleEntry): boolean => {
    return name === 'showSideBar' ? showSideBar.value : showTabBar.value
  }

  function SET_LAYOUT(
    layout: LayoutPartial,
    { scheduleBufferUpdate = true }: SetLayoutOptions = {}
  ): void {
    if (layout.showSideBar !== undefined) {
      const { windowId } = window.marktext?.env ?? {}
      window.electron.ipcRenderer.send(
        'mt::update-sidebar-menu',
        Number(windowId),
        !!layout.showSideBar
      )
      const preferencesStore = usePreferencesStore()
      preferencesStore.SET_SINGLE_PREFERENCE({
        type: 'sideBarVisibility',
        value: !!layout.showSideBar
      })
    }
    if (layout.rightColumn !== undefined) rightColumn.value = layout.rightColumn
    if (layout.secondaryColumn !== undefined) secondaryColumn.value = layout.secondaryColumn
    if (layout.showSideBar !== undefined) showSideBar.value = !!layout.showSideBar
    if (layout.showSecondarySideBar !== undefined) showSecondarySideBar.value = !!layout.showSecondarySideBar
    if (layout.showTabBar !== undefined) showTabBar.value = !!layout.showTabBar
    if (layout.sideBarWidth !== undefined) sideBarWidth.value = layout.sideBarWidth as number
    if (layout.secondarySideBarWidth !== undefined) secondarySideBarWidth.value = layout.secondarySideBarWidth as number
    if (scheduleBufferUpdate) {
      debouncedSendBufferedState()
    }
  }

  function CREATE_BUFFERED_STATE(): BufferedLayout | null {
    return createBufferedLayoutState({
      rightColumn: rightColumn.value,
      secondaryColumn: secondaryColumn.value,
      showSideBar: showSideBar.value,
      showSecondarySideBar: showSecondarySideBar.value,
      showTabBar: showTabBar.value,
      sideBarWidth: sideBarWidth.value,
      secondarySideBarWidth: secondarySideBarWidth.value
    })
  }

  function RESTORE_BUFFERED_STATE(state: unknown): void {
    const layout = createBufferedLayoutState(state)
    if (!layout) return

    SET_SIDE_BAR_WIDTH(layout.sideBarWidth, { scheduleBufferUpdate: false })
    SET_SECONDARY_SIDE_BAR_WIDTH(layout.secondarySideBarWidth, { scheduleBufferUpdate: false })
    SET_LAYOUT(
      {
        rightColumn: layout.rightColumn,
        secondaryColumn: layout.secondaryColumn,
        showSideBar: layout.showSideBar,
        showSecondarySideBar: layout.showSecondarySideBar,
        showTabBar: layout.showTabBar
      },
      { scheduleBufferUpdate: false }
    )
    DISPATCH_LAYOUT_MENU_ITEMS()
  }

  function TOGGLE_LAYOUT_ENTRY(entryName: LayoutToggleEntry): void {
    if (entryName === 'showSideBar') {
      showSideBar.value = !showSideBar.value
      const preferencesStore = usePreferencesStore()
      preferencesStore.SET_SINGLE_PREFERENCE({
        type: 'sideBarVisibility',
        value: !!showSideBar.value
      })
    } else if (entryName === 'showTabBar') {
      showTabBar.value = !showTabBar.value
    }
    debouncedSendBufferedState()
  }

  function SET_SIDE_BAR_WIDTH(
    width: number | string,
    { scheduleBufferUpdate = true }: SetLayoutOptions = {}
  ): void {
    const normalizedWidth = normalizeSideBarWidth(width)
    localStorage.setItem('side-bar-width', String(normalizedWidth))
    sideBarWidth.value = normalizedWidth
    if (scheduleBufferUpdate) {
      debouncedSendBufferedState()
    }
  }

  /**
   * Persists and applies the secondary (right) sidebar width.
   * @param width Desired width; clamped to a minimum and saved to localStorage.
   */
  function SET_SECONDARY_SIDE_BAR_WIDTH(
    width: number | string,
    { scheduleBufferUpdate = true }: SetLayoutOptions = {}
  ): void {
    const normalizedWidth = normalizeSideBarWidth(width)
    localStorage.setItem('secondary-side-bar-width', String(normalizedWidth))
    secondarySideBarWidth.value = normalizedWidth
    if (scheduleBufferUpdate) {
      debouncedSendBufferedState()
    }
  }

  function LISTEN_FOR_LAYOUT(): void {
    window.electron.ipcRenderer.on('mt::set-view-layout', (_e, layout) => {
      const l = layout as unknown as LayoutPartial
      if (l.secondaryColumn) {
        // Secondary sidebar content selection behaves as a toggle: re-selecting
        // the active view hides the panel; otherwise show the panel with that view.
        if (l.secondaryColumn === secondaryColumn.value && showSecondarySideBar.value) {
          SET_LAYOUT({ showSecondarySideBar: false })
        } else {
          SET_LAYOUT({ secondaryColumn: l.secondaryColumn, showSecondarySideBar: true })
        }
      } else if (l.rightColumn) {
        SET_LAYOUT({
          ...l,
          rightColumn: l.rightColumn === rightColumn.value ? '' : l.rightColumn,
          showSideBar: true
        })
      } else {
        SET_LAYOUT(l)
      }
      DISPATCH_LAYOUT_MENU_ITEMS()
    })

    window.electron.ipcRenderer.on('mt::toggle-view-layout-entry', (_e, entryName) => {
      TOGGLE_LAYOUT_ENTRY(entryName as LayoutToggleEntry)
      DISPATCH_LAYOUT_MENU_ITEMS()
    })

    bus.on('view:toggle-layout-entry', (entryName: unknown) => {
      const name = entryName as LayoutToggleEntry
      TOGGLE_LAYOUT_ENTRY(name)
      const { windowId } = window.marktext?.env ?? {}
      window.electron.ipcRenderer.send('mt::view-layout-changed', Number(windowId), {
        [name]: layoutEntryValue(name)
      })
    })
  }

  function DISPATCH_LAYOUT_MENU_ITEMS(): void {
    const { windowId } = window.marktext?.env ?? {}
    window.electron.ipcRenderer.send('mt::view-layout-changed', Number(windowId), {
      showTabBar: showTabBar.value,
      showSideBar: showSideBar.value,
      showSecondarySideBar: showSecondarySideBar.value,
      secondaryColumn: secondaryColumn.value
    })
  }

  function CHANGE_SIDE_BAR_WIDTH(width: number | string): void {
    SET_SIDE_BAR_WIDTH(width)
  }

  /** Updates the secondary sidebar width in response to a user drag-resize. */
  function CHANGE_SECONDARY_SIDE_BAR_WIDTH(width: number | string): void {
    SET_SECONDARY_SIDE_BAR_WIDTH(width)
  }

  return {
    rightColumn,
    secondaryColumn,
    showSideBar,
    showSecondarySideBar,
    showTabBar,
    sideBarWidth,
    secondarySideBarWidth,
    effectiveSideBarWidth,
    SET_LAYOUT,
    CREATE_BUFFERED_STATE,
    RESTORE_BUFFERED_STATE,
    TOGGLE_LAYOUT_ENTRY,
    SET_SIDE_BAR_WIDTH,
    SET_SECONDARY_SIDE_BAR_WIDTH,
    LISTEN_FOR_LAYOUT,
    DISPATCH_LAYOUT_MENU_ITEMS,
    CHANGE_SIDE_BAR_WIDTH,
    CHANGE_SECONDARY_SIDE_BAR_WIDTH
  }
})
