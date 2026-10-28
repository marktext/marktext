import { computed, ref, watch, onScopeDispose } from 'vue'
import { defineStore } from 'pinia'
import bus from '../bus'
import { usePreferencesStore } from './preferences'
import { debouncedSendBufferedState } from './bufferedState'
import type { WindowLayoutState } from '@shared/types/applicationState'
import type { LayoutState } from '@shared/types/preferences'
import { createDefaultLayout } from '@shared/applicationState/defaults'

interface LayoutPartial {
  rightColumn?: string
  showSideBar?: boolean
  showTabBar?: boolean
  sideBarWidth?: number | string
}

interface SetLayoutOptions {
  scheduleBufferUpdate?: boolean
}

const defaultLayout = createDefaultLayout()

const normalizeSideBarWidth = (width: unknown): number => {
  const numericWidth = Number(width)
  return Number.isFinite(numericWidth)
    ? Math.max(numericWidth, 220)
    : defaultLayout.sidebar.preferredWidthPx
}

interface BufferedLayout {
  rightColumn: string | undefined
  showSideBar: boolean
  showTabBar: boolean
  sideBarWidth: number
}

const createBufferedLayoutState = (state: unknown): BufferedLayout | null => {
  if (!state || typeof state !== 'object') return null
  const s = state as LayoutPartial

  // Pass through `rightColumn` (may be undefined). The pre-migration JS did
  // not coerce to 'files' here — RESTORE_BUFFERED_STATE then routes through
  // SET_LAYOUT which only assigns when the key is defined.
  return {
    rightColumn: s.rightColumn,
    showSideBar: !!s.showSideBar,
    showTabBar: !!s.showTabBar,
    sideBarWidth: normalizeSideBarWidth(s.sideBarWidth)
  }
}

const initialWidth = localStorage.getItem('side-bar-width')
const initialSideBarWidth = normalizeSideBarWidth(initialWidth)

export const useLayoutStore = defineStore('layout', () => {
  const preferencesStore = usePreferencesStore()
  // Enabled by the session host after initialization; legacy windows keep their existing adapters.
  const managed = ref(false)
  const outlineVisible = ref(defaultLayout.outline.visible)
  const outlinePositionValue = ref(defaultLayout.outline.position)
  const outlinePosition = computed(() =>
    managed.value ? outlinePositionValue.value : preferencesStore.tocPosition
  )
  const outlineWidth = ref(defaultLayout.outline.preferredWidthPx)
  const openedFilesExpanded = ref(defaultLayout.sidebar.openedFiles.expanded)
  const openedFilesHeight = ref(defaultLayout.sidebar.openedFiles.preferredHeightPx)
  let changed: (() => void) | undefined
  const showToc = computed(() =>
    managed.value ? outlineVisible.value : preferencesStore.tocVisibility
  )
  const rightColumn = ref<LayoutState['rightColumn']>('files')
  const showSideBar = ref(defaultLayout.sidebar.visible)
  const showTabBar = ref(defaultLayout.tabBar.visible)
  const sideBarWidth = ref<number>(initialSideBarWidth)
  const viewportWidth = ref(window.innerWidth)
  const updateViewport = (): void => {
    viewportWidth.value = window.innerWidth
  }
  window.addEventListener('resize', updateViewport)
  onScopeDispose(() => window.removeEventListener('resize', updateViewport))
  const sideBarMaximumWidth = computed(() =>
    managed.value ? Math.max(220, viewportWidth.value - 320) : Infinity
  )

  const effectiveSideBarWidth = computed<number>(() => {
    return showSideBar.value ? Math.min(Number(sideBarWidth.value), sideBarMaximumWidth.value) : 0
  })

  function SET_LAYOUT(
    layout: LayoutPartial,
    { scheduleBufferUpdate = true }: SetLayoutOptions = {}
  ): void {
    if (layout.showSideBar !== undefined && !managed.value) {
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
    // Older sessions could restore an outline page or an icon-only strip.
    if (layout.rightColumn !== undefined)
      rightColumn.value = layout.rightColumn === 'search' ? 'search' : 'files'
    if (layout.showSideBar !== undefined) showSideBar.value = !!layout.showSideBar
    if (layout.showTabBar !== undefined) showTabBar.value = !!layout.showTabBar
    if (layout.sideBarWidth !== undefined)
      sideBarWidth.value = normalizeSideBarWidth(layout.sideBarWidth)
    if (scheduleBufferUpdate && !managed.value) {
      debouncedSendBufferedState()
    }
  }

  function CREATE_BUFFERED_STATE(): BufferedLayout | null {
    return createBufferedLayoutState({
      rightColumn: rightColumn.value,
      showSideBar: showSideBar.value,
      showTabBar: showTabBar.value,
      sideBarWidth: sideBarWidth.value
    })
  }

  function RESTORE_BUFFERED_STATE(state: unknown): void {
    const layout = createBufferedLayoutState(state)
    if (!layout) return

    SET_SIDE_BAR_WIDTH(layout.sideBarWidth, { scheduleBufferUpdate: false })
    SET_LAYOUT(
      {
        rightColumn: layout.rightColumn,
        showSideBar: layout.showSideBar,
        showTabBar: layout.showTabBar
      },
      { scheduleBufferUpdate: false }
    )
    DISPATCH_LAYOUT_MENU_ITEMS()
  }

  function TOGGLE_LAYOUT_ENTRY(entryName: 'showSideBar' | 'showTabBar' | 'showToc'): void {
    if (entryName === 'showToc') {
      if (managed.value) outlineVisible.value = !showToc.value
      else preferencesStore.SET_SINGLE_PREFERENCE({ type: 'tocVisibility', value: !showToc.value })
    } else if (entryName === 'showSideBar') {
      showSideBar.value = !showSideBar.value
      if (!managed.value)
        preferencesStore.SET_SINGLE_PREFERENCE({
          type: 'sideBarVisibility',
          value: !!showSideBar.value
        })
    } else if (entryName === 'showTabBar') {
      showTabBar.value = !showTabBar.value
    }
    if (!managed.value) debouncedSendBufferedState()
  }

  function SET_SIDE_BAR_WIDTH(
    width: number | string,
    { scheduleBufferUpdate = true }: SetLayoutOptions = {}
  ): void {
    const normalizedWidth = normalizeSideBarWidth(width)
    if (!managed.value) localStorage.setItem('side-bar-width', String(normalizedWidth))
    sideBarWidth.value = normalizedWidth
    if (scheduleBufferUpdate && !managed.value) {
      debouncedSendBufferedState()
    }
  }

  function LISTEN_FOR_LAYOUT(): void {
    window.electron.ipcRenderer.on('mt::set-view-layout', (_e, layout) => {
      const l = layout as unknown as LayoutPartial
      if (l.rightColumn) {
        SET_LAYOUT({
          ...l,
          showSideBar: true
        })
      } else {
        SET_LAYOUT(l)
      }
      DISPATCH_LAYOUT_MENU_ITEMS()
    })

    window.electron.ipcRenderer.on('mt::toggle-view-layout-entry', (_e, entryName) => {
      TOGGLE_LAYOUT_ENTRY(entryName as 'showSideBar' | 'showTabBar' | 'showToc')
      DISPATCH_LAYOUT_MENU_ITEMS()
    })

    bus.on('view:toggle-layout-entry', (entryName: unknown) => {
      const name = entryName as 'showSideBar' | 'showTabBar' | 'showToc'
      TOGGLE_LAYOUT_ENTRY(name)
      const { windowId } = window.marktext?.env ?? {}
      window.electron.ipcRenderer.send('mt::view-layout-changed', Number(windowId), {
        [name]:
          name === 'showSideBar'
            ? showSideBar.value
            : name === 'showToc'
              ? showToc.value
              : showTabBar.value
      })
    })
  }

  function DISPATCH_LAYOUT_MENU_ITEMS(): void {
    const { windowId } = window.marktext?.env ?? {}
    window.electron.ipcRenderer.send('mt::view-layout-changed', Number(windowId), {
      showToc: showToc.value,
      showTabBar: showTabBar.value,
      showSideBar: showSideBar.value
    })
  }

  function INITIALIZE_WINDOW_LAYOUT(layout: WindowLayoutState, onChange?: () => void): void {
    managed.value = false
    const state = structuredClone(layout)
    showSideBar.value = state.sidebar.visible
    rightColumn.value = state.sidebar.activeView
    sideBarWidth.value = normalizeSideBarWidth(state.sidebar.preferredWidthPx)
    showTabBar.value = state.tabBar.visible
    outlineVisible.value = state.outline.visible
    outlinePositionValue.value = state.outline.position
    outlineWidth.value = state.outline.preferredWidthPx
    openedFilesExpanded.value = state.sidebar.openedFiles.expanded
    openedFilesHeight.value = state.sidebar.openedFiles.preferredHeightPx
    preferencesStore.SET_MODE({ type: 'sourceCode', checked: state.modes.sourceCode })
    preferencesStore.SET_MODE({ type: 'focus', checked: state.modes.focus })
    preferencesStore.SET_MODE({ type: 'typewriter', checked: state.modes.typewriter })
    changed = onChange
    managed.value = true
  }

  function CAPTURE_WINDOW_LAYOUT(): WindowLayoutState {
    return {
      sidebar: {
        visible: showSideBar.value,
        activeView: rightColumn.value,
        preferredWidthPx: sideBarWidth.value,
        openedFiles: {
          expanded: openedFilesExpanded.value,
          preferredHeightPx: openedFilesHeight.value
        }
      },
      outline: {
        visible: showToc.value,
        position: outlinePosition.value,
        preferredWidthPx: outlineWidth.value
      },
      tabBar: { visible: showTabBar.value },
      modes: {
        sourceCode: preferencesStore.sourceCode,
        focus: preferencesStore.focus,
        typewriter: preferencesStore.typewriter
      }
    }
  }

  function SET_OUTLINE_WIDTH(width: number): void {
    if (Number.isFinite(width)) outlineWidth.value = Math.max(180, Math.min(600, width))
  }

  function SET_OPENED_FILES(value: { expanded?: boolean; preferredHeightPx?: number }): void {
    if (value.expanded !== undefined) openedFilesExpanded.value = value.expanded
    if (value.preferredHeightPx !== undefined && Number.isFinite(value.preferredHeightPx))
      openedFilesHeight.value = Math.max(0, value.preferredHeightPx)
  }

  watch(
    () => [
      rightColumn.value,
      showSideBar.value,
      showTabBar.value,
      sideBarWidth.value,
      outlineVisible.value,
      outlinePositionValue.value,
      outlineWidth.value,
      openedFilesExpanded.value,
      openedFilesHeight.value,
      preferencesStore.sourceCode,
      preferencesStore.focus,
      preferencesStore.typewriter
    ],
    () => {
      if (managed.value) changed?.()
    },
    { flush: 'sync' }
  )

  watch(showToc, DISPATCH_LAYOUT_MENU_ITEMS)

  return {
    managed,
    outlinePosition,
    outlineWidth,
    openedFilesExpanded,
    openedFilesHeight,
    sideBarMaximumWidth,
    INITIALIZE_WINDOW_LAYOUT,
    CAPTURE_WINDOW_LAYOUT,
    SET_OUTLINE_WIDTH,
    SET_OPENED_FILES,
    showToc,
    rightColumn,
    showSideBar,
    showTabBar,
    sideBarWidth,
    effectiveSideBarWidth,
    SET_LAYOUT,
    CREATE_BUFFERED_STATE,
    RESTORE_BUFFERED_STATE,
    TOGGLE_LAYOUT_ENTRY,
    SET_SIDE_BAR_WIDTH,
    LISTEN_FOR_LAYOUT,
    DISPATCH_LAYOUT_MENU_ITEMS
  }
})
