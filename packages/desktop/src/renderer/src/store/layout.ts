import { computed, ref, watch, onScopeDispose } from 'vue'
import { defineStore } from 'pinia'
import bus from '../bus'
import { usePreferencesStore } from './preferences'
import type { WindowLayoutState } from '@shared/types/applicationState'
import { createDefaultLayout } from '@shared/applicationState/defaults'

interface LayoutPartial {
  rightColumn?: string
  showSideBar?: boolean
  showTabBar?: boolean
  sideBarWidth?: number | string
}

const defaultLayout = createDefaultLayout()

const normalizeSideBarWidth = (width: unknown): number => {
  const numericWidth = Number(width)
  return Number.isFinite(numericWidth)
    ? Math.max(numericWidth, 220)
    : defaultLayout.sidebar.preferredWidthPx
}

export const useLayoutStore = defineStore('layout', () => {
  const preferencesStore = usePreferencesStore()
  let initializing = false
  const outlineVisible = ref(defaultLayout.outline.visible)
  const outlinePosition = ref(defaultLayout.outline.position)
  const outlineWidth = ref(defaultLayout.outline.preferredWidthPx)
  const openedFilesExpanded = ref(defaultLayout.sidebar.openedFiles.expanded)
  const openedFilesHeight = ref(defaultLayout.sidebar.openedFiles.preferredHeightPx)
  let changed: (() => void) | undefined
  const showToc = outlineVisible
  const rightColumn = ref(defaultLayout.sidebar.activeView)
  const showSideBar = ref(defaultLayout.sidebar.visible)
  const showTabBar = ref(defaultLayout.tabBar.visible)
  const sideBarWidth = ref(defaultLayout.sidebar.preferredWidthPx)
  const viewportWidth = ref(window.innerWidth)
  const updateViewport = (): void => {
    viewportWidth.value = window.innerWidth
  }
  window.addEventListener('resize', updateViewport)
  onScopeDispose(() => window.removeEventListener('resize', updateViewport))
  const sideBarMaximumWidth = computed(() =>
    Math.max(220, viewportWidth.value - 320)
  )

  const effectiveSideBarWidth = computed<number>(() => {
    return showSideBar.value ? Math.min(Number(sideBarWidth.value), sideBarMaximumWidth.value) : 0
  })

  function SET_LAYOUT(
    layout: LayoutPartial
  ): void {
    if (layout.rightColumn !== undefined)
      rightColumn.value = layout.rightColumn === 'search' ? 'search' : 'files'
    if (layout.showSideBar !== undefined) showSideBar.value = !!layout.showSideBar
    if (layout.showTabBar !== undefined) showTabBar.value = !!layout.showTabBar
    if (layout.sideBarWidth !== undefined)
      sideBarWidth.value = normalizeSideBarWidth(layout.sideBarWidth)
  }

  function TOGGLE_LAYOUT_ENTRY(entryName: 'showSideBar' | 'showTabBar' | 'showToc'): void {
    if (entryName === 'showToc') outlineVisible.value = !outlineVisible.value
    else if (entryName === 'showSideBar') showSideBar.value = !showSideBar.value
    else showTabBar.value = !showTabBar.value
  }

  function SET_SIDE_BAR_WIDTH(
    width: number | string
  ): void {
    const normalizedWidth = normalizeSideBarWidth(width)
    sideBarWidth.value = normalizedWidth
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
    initializing = true
    const state = structuredClone(layout)
    showSideBar.value = state.sidebar.visible
    rightColumn.value = state.sidebar.activeView
    sideBarWidth.value = normalizeSideBarWidth(state.sidebar.preferredWidthPx)
    showTabBar.value = state.tabBar.visible
    outlineVisible.value = state.outline.visible
    outlinePosition.value = state.outline.position
    outlineWidth.value = state.outline.preferredWidthPx
    openedFilesExpanded.value = state.sidebar.openedFiles.expanded
    openedFilesHeight.value = state.sidebar.openedFiles.preferredHeightPx
    preferencesStore.SET_MODE({ type: 'sourceCode', checked: state.modes.sourceCode })
    preferencesStore.SET_MODE({ type: 'focus', checked: state.modes.focus })
    preferencesStore.SET_MODE({ type: 'typewriter', checked: state.modes.typewriter })
    changed = onChange
    initializing = false
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
      outlinePosition.value,
      outlineWidth.value,
      openedFilesExpanded.value,
      openedFilesHeight.value,
      preferencesStore.sourceCode,
      preferencesStore.focus,
      preferencesStore.typewriter
    ],
    () => {
      if (!initializing) changed?.()
    },
    { flush: 'sync' }
  )

  watch(showToc, DISPATCH_LAYOUT_MENU_ITEMS)

  return {
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
    TOGGLE_LAYOUT_ENTRY,
    SET_SIDE_BAR_WIDTH,
    LISTEN_FOR_LAYOUT,
    DISPATCH_LAYOUT_MENU_ITEMS
  }
})
